<?php
/**
 * Test Storage\Base cutting an over-long varchar value on insert: by characters, not bytes
 *
 * A Greek letter is 2 bytes. Cut by bytes, a value within the column's characters was cut in half,
 * and cut inside a letter it became invalid UTF-8, which Db::quote() wrote as an empty string.
 * Works on a temporary table of its own, made known through Db::set_table_definitions(), so it
 * needs neither the test app nor a login.
 *
 * @link http://www.egroupware.org
 * @package api
 * @subpackage tests
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 */

namespace EGroupware\Api\Storage;

use EGroupware\Api;
use PHPUnit\Framework\TestCase;

class VarcharTruncateTest extends TestCase
{
	const TABLE = 'egw_test_varchar_truncate';
	const APP = 'test_varchar_truncate';

	/**
	 * @var Api\Db
	 */
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
		$GLOBALS['egw'] = new \stdClass();
		$GLOBALS['egw']->db = self::$db = new Api\Db($GLOBALS['egw_domain'][$domain]);
		self::$db->connect();
		if (substr(self::$db->Type, 0, 5) !== 'mysql')
		{
			self::markTestSkipped('The temporary table is written for MySQL/MariaDB');
		}
		self::$db->query('CREATE TEMPORARY TABLE '.self::TABLE.' (t_id INT AUTO_INCREMENT PRIMARY KEY, t_title VARCHAR(10)) DEFAULT CHARSET=utf8', __LINE__, __FILE__);
		Api\Db::set_table_definitions(self::APP, self::TABLE, ['fd' => [
			't_id' => ['type' => 'auto', 'nullable' => false],
			't_title' => ['type' => 'varchar', 'precision' => '10'],
		], 'pk' => ['t_id'], 'fk' => [], 'ix' => [], 'uc' => []]);
	}

	private function insert(string $title) : string
	{
		$storage = new Base(self::APP, self::TABLE, self::$db, '', true);
		$storage->data = ['t_title' => $title];
		$this->assertEquals(0, $storage->save());
		return (string)self::$db->select(self::TABLE, 't_title', ['t_id' => $storage->data['t_id']], __LINE__, __FILE__)->fetchColumn();
	}

	public static function tearDownAfterClass() : void
	{
		self::$db?->query('DROP TEMPORARY TABLE IF EXISTS '.self::TABLE, __LINE__, __FILE__);
	}

	public static function titles() : array
	{
		return [
			'ascii within' => ['abcdefghij', 'abcdefghij'],
			'ascii too long' => ['abcdefghijkl', 'abcdefghij'],
			// 10 characters, 20 bytes: fits the column, was cut to 5
			'greek within' => ['Αλεξάνδρος', 'Αλεξάνδρος'],
			// 11 characters starting with a 1-byte one: a byte cut ends inside a letter - was stored empty
			'greek too long, odd' => ['Α Βασιλείου', 'Α Βασιλείο'],
			'greek too long, even' => ['Παπαδοπούλου', 'Παπαδοπούλ'],
		];
	}

	#[\PHPUnit\Framework\Attributes\DataProvider('titles')]
	public function testInsertCutsByCharacters(string $title, string $expected)
	{
		$this->assertSame($expected, $this->insert($title));
	}
}
