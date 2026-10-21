<?php
/**
 * EGroupware Api: Api\Db::select() with an empty where array selects all rows
 *
 * Since Db\SqlFragment column_data_implode() returns an object also for an empty array, and select() took any
 * object for a condition: "SELECT app_name FROM egw_applications WHERE " - an SQL syntax error.
 *
 * @link http://www.egroupware.org
 * @package api
 * @subpackage tests
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 */

use EGroupware\Api;
use PHPUnit\Framework\TestCase;

/**
 * Bootstrap mirrors api/tests/Db/SqlFragmentTest.php; reads egw_applications only, which every install has.
 */
class SelectEmptyWhereTest extends TestCase
{
	/** @var Api\Db */
	private static $db;

	public static function setUpBeforeClass() : void
	{
		if (ini_get('session.save_handler') == 'files' && !is_writable(ini_get('session.save_path')) && is_dir('/tmp') && is_writable('/tmp'))
		{
			ini_set('session.save_path','/tmp');
		}
		$_REQUEST['domain'] = $GLOBALS['EGW_DOMAIN'];

		$GLOBALS['egw_info'] = array(
			'flags' => array(
				'noheader' => True,
				'nonavbar' => True,
				'currentapp' => 'setup',
				'noapi' => true,
		));
		require(__DIR__.'/../../../header.inc.php');

		$default_domain = null;
		$domain = Api\Session::search_instance(null, $GLOBALS['EGW_DOMAIN'], $default_domain,
			array($_SERVER['HTTP_HOST'] ?? '', $_SERVER['SERVER_NAME'] ?? ''), $GLOBALS['egw_domain']);

		$GLOBALS['egw'] = new stdClass();
		$GLOBALS['egw']->db = self::$db = new Api\Db($GLOBALS['egw_domain'][$domain]);
		self::$db->connect();
	}

	private function countRows($where) : int
	{
		return (int)self::$db->select('egw_applications', 'COUNT(*)', $where, __LINE__, __FILE__)->fetchColumn();
	}

	public function testEmptyArrayIsNoCondition()
	{
		$all = $this->countRows(false);
		$this->assertGreaterThan(0, $all);
		$this->assertSame($all, $this->countRows([]), 'an empty where array selects all rows, as false does');
	}

	public function testConditionStillApplies()
	{
		$this->assertSame(1, $this->countRows(['app_name' => 'api']));
		$this->assertSame(0, $this->countRows(['app_name' => 'no-such-app']));
	}
}
