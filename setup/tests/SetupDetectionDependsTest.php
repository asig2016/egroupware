<?php
/**
 * EGroupware Setup: setup_detection::check_depends() - when an app waits for the app it depends on
 *
 * An app whose dependency is not met gets status "D" and is updated in a later pass of setup_process::pass(), after the
 * other one. A version of four parts ("0.0.0.134", as the ac* apps number theirs) is the least version needed; the
 * major setup compares is only three parts, so "0.0.0.118" used to accept 0.0.0.113 and refuse 0.0.0.155.
 *
 * @link https://www.egroupware.org
 * @package setup
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 */

use PHPUnit\Framework\TestCase;

require_once __DIR__.'/../inc/class.setup.inc.php';
require_once __DIR__.'/../inc/class.setup_detection.inc.php';

class SetupDetectionDependsTest extends TestCase
{
	/**
	 * @var mixed setup object of another test, put back after each
	 */
	private $egw_setup;

	protected function setUp() : void
	{
		$this->egw_setup = $GLOBALS['egw_setup'] ?? null;
		// check_depends() needs get_major() only, not a database
		$GLOBALS['egw_setup'] = (new ReflectionClass('setup'))->newInstanceWithoutConstructor();
	}

	protected function tearDown() : void
	{
		$GLOBALS['egw_setup'] = $this->egw_setup;
	}

	/**
	 * Status of "app" depending on "dep" in the given versions, "dep" installed in $installed ('' = not installed)
	 */
	private function dependentStatus(array $versions, string $installed) : string
	{
		$info = (new setup_detection())->check_depends([
			'dep' => ['name' => 'dep', 'status' => 'C'] + ($installed !== '' ? ['currentver' => $installed] : []),
			'app' => ['name' => 'app', 'currentver' => '0.0.0.020', 'status' => 'U',
				'depends' => [['appname' => 'dep', 'versions' => $versions]]],
		]);
		return $info['app']['status'];
	}

	public static function fourPartVersions() : array
	{
		return [
			'older: waits'           => [['0.0.0.134'], '0.0.0.113', 'D'],
			'the same: goes ahead'   => [['0.0.0.134'], '0.0.0.134', 'U'],
			'later: goes ahead'      => [['0.0.0.134'], '0.0.0.155', 'U'],
			'not installed: waits'   => [['0.0.0.134'], '', 'D'],
			'one of two is enough'   => [['0.0.0.200', '0.0.0.134'], '0.0.0.155', 'U'],
			'longer major'           => [['21.1.0.008'], '21.1.0.000', 'D'],
			'longer major, later'    => [['21.1.0.008'], '23.1.0.013', 'U'],
		];
	}

	/**
	 * @dataProvider fourPartVersions
	 */
	#[\PHPUnit\Framework\Attributes\DataProvider('fourPartVersions')]
	public function testFourPartsAreTheLeastVersion(array $versions, string $installed, string $status)
	{
		$this->assertSame($status, $this->dependentStatus($versions, $installed));
	}

	public static function shorterVersions() : array
	{
		return [
			'a major: older waits'      => [['26.1'], '21.1', 'D'],
			'a major: the same'         => [['26.1'], '26.1.003', 'U'],
			'an ac* prefix "0.0"'       => [['0.0', '1.0'], '0.0.0.113', 'U'],
			'an ac* prefix "0."'        => [['0.'], '0.0.0.155', 'U'],
		];
	}

	/**
	 * The forms in use until now mean what they meant
	 *
	 * @dataProvider shorterVersions
	 */
	#[\PHPUnit\Framework\Attributes\DataProvider('shorterVersions')]
	public function testShorterVersionsUnchanged(array $versions, string $installed, string $status)
	{
		$this->assertSame($status, $this->dependentStatus($versions, $installed));
	}
}
