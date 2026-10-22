<?php
/**
 * EGroupware Api: Asyncservice::check_run() must give every job a clean user context
 *
 * @link https://www.egroupware.org
 * @package api
 * @subpackage test
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 */

namespace EGroupware\Api;

require_once __DIR__ . '/LoggedInTest.php';

/**
 * check_run() runs the due jobs of ALL users in one process and switches the user before each job.
 * It re-read account, ACL, preferences and apps, but a job still inherited from the previous job,
 * of another user: the session-cache ($_SESSION, eg. Link's title and file-access caches, Vfs eacls),
 * Link's static caches and bo-objects, and the sub-objects lazily created on $GLOBALS['egw'] (eg.
 * categories, bound to the previous user's account_id). The fallback run, inside a visitor's web
 * request, wrote the jobs' session-cache into the visitor's session too.
 *
 * Setup: check_run() of an Asyncservice whose semaphore, job list and job writes are stubbed, so no
 * real egw_async row is read, run, changed or deleted. It runs two probe jobs as two different
 * existing users (read only): the first one leaves state behind, the second one records what it sees,
 * and so does a third one without a user (account_id 0).
 *
 * Pass: the second job sees its own account, nothing of the first job in the session-cache or in
 * Link's file-access cache, and a categories object of its own; the job without a user sees none of
 * it either; and the session-cache of the caller is unchanged afterwards.
 */
class AsyncserviceUserSwitchTest extends LoggedInTest
{
	/**
	 * What the probe jobs saw, by step
	 *
	 * @var array
	 */
	public static $seen = [];

	/**
	 * Account of the test session, to restore it after check_run() switched users
	 *
	 * @var int
	 */
	protected $account_id;

	protected function setUp() : void
	{
		parent::setUp();
		self::$seen = [];
		$this->account_id = (int)$GLOBALS['egw_info']['user']['account_id'];
	}

	protected function tearDown() : void
	{
		// switch back to the user of the test session
		$GLOBALS['egw']->session->account_id = $this->account_id;
		$GLOBALS['egw']->session->account_lid = Accounts::id2name($this->account_id);
		$GLOBALS['egw_info']['user'] = $GLOBALS['egw']->session->read_repositories();
		Vfs::$user = $this->account_id;
		Vfs\StreamWrapper::init_static();
		unset($GLOBALS['egw_info']['flags']['async-service']);
		Cache::unsetSession(__CLASS__, 'visitor');
		Link::init_static(true);

		parent::tearDown();
	}

	/**
	 * Job method: step "leave" leaves user-bound state behind, step "record" records what it sees
	 *
	 * @param array $data job data incl. the job itself
	 */
	public static function probe(array $data)
	{
		if ($data['step'] === 'leave')
		{
			Cache::setSession(__CLASS__, 'marker', $GLOBALS['egw_info']['user']['account_id']);
			Link::set_cache(__CLASS__, 1, 'title only the first user may see', Acl::READ|Acl::EDIT);
		}
		$file_access = (new \ReflectionProperty(Link::class, 'file_access_cache'))->getValue();
		self::$seen[$data['step']] = [
			'account_id' => $GLOBALS['egw_info']['user']['account_id'],
			'session_marker' => Cache::getSession(__CLASS__, 'marker'),
			'link_file_access' => $file_access[__CLASS__.':1'] ?? null,
			'categories_owner' => $data['account_id'] ? $GLOBALS['egw']->categories->account_id : null,
		];
	}

	public function testJobDoesNotInheritThePreviousJobsUser()
	{
		$users = [];
		foreach($GLOBALS['egw']->db->select(Accounts\Sql::TABLE, 'account_id', [
			'account_type' => 'u',
			'account_status' => 'A',
		], __LINE__, __FILE__, 0, 'ORDER BY account_id', 'phpgwapi', 2) as $row)
		{
			$users[] = (int)$row['account_id'];
		}
		if (count($users) < 2)
		{
			$this->markTestSkipped('needs two active user accounts');
		}
		[$first, $second] = $users;

		// the fallback runs inside a visitor's request, whose session-cache must survive the run
		Cache::setSession(__CLASS__, 'visitor', 'kept');

		$job = [
			'next' => time() - 60,
			'times' => time() - 60,	// one-time job: check_run() deletes it (stubbed) instead of rescheduling
			'method' => __CLASS__.'::probe',
		];
		$async = new class([
			['id' => 'user-switch-test-1', 'account_id' => $first, 'data' => ['step' => 'leave']] + $job,
			['id' => 'user-switch-test-2', 'account_id' => $second, 'data' => ['step' => 'record']] + $job,
			// a job without a user (eg. news_admin's import) must not run with the previous user's caches either
			['id' => 'user-switch-test-3', 'account_id' => 0, 'data' => ['step' => 'no-user']] + $job,
		]) extends Asyncservice
		{
			private $jobs;

			function __construct(array $jobs)
			{
				parent::__construct();
				$this->jobs = $jobs;
			}

			// no semaphore, no real jobs, no writes: nothing of egw_async is touched
			function last_check_run($semaphore=False,$release=False,$run_by='')
			{
				return $semaphore ? true : [];
			}

			function read($id=null, $cols='*', $offset=False, $append=null, $num_rows=0)
			{
				return $this->jobs;
			}

			function write($job, $exists = False, $where=array())
			{
				return 1;
			}

			function delete($id)
			{
				return 1;
			}
		};
		$this->assertSame(3, $async->check_run('test'));

		$this->assertSame($first, (int)self::$seen['leave']['account_id'], 'first job ran as the first user');
		$this->assertSame($first, (int)self::$seen['leave']['categories_owner'], "first job uses the caller's categories object");
		$this->assertNotNull(self::$seen['leave']['link_file_access'], 'first job left a Link cache entry');

		$this->assertSame($second, (int)self::$seen['record']['account_id'], 'second job runs as the second user');
		$this->assertNull(self::$seen['record']['session_marker'], "second job sees the first job's session-cache");
		$this->assertNull(self::$seen['record']['link_file_access'], "second job sees the first user's Link file-access");
		$this->assertSame($second, (int)self::$seen['record']['categories_owner'], "second job uses the first user's categories object");

		$this->assertEmpty(self::$seen['no-user']['account_id'], 'job without a user runs without one');
		$this->assertNull(self::$seen['no-user']['session_marker'], "job without a user sees a previous job's session-cache");
		$this->assertNull(self::$seen['no-user']['link_file_access'], "job without a user sees a previous user's Link file-access");

		$this->assertSame('kept', Cache::getSession(__CLASS__, 'visitor'), "caller's session-cache was lost");
		$this->assertNull(Cache::getSession(__CLASS__, 'marker'), "a job's session-cache leaked into the caller's session");
	}
}
