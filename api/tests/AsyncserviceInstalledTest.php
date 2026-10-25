<?php
/**
 * EGroupware Api: Asyncservice::installed() finds the crontab also where the webserver may not run a shell
 *
 * @link https://www.egroupware.org
 * @package api
 * @subpackage test
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 */

namespace EGroupware\Api;

use PHPUnit\Framework\TestCase;

/**
 * installed() read the crontab only with popen('crontab -l'). A webserver whose PHP may not run a shell
 * (disable_functions = ...,popen, eg. a hardened FPM pool) always got False: Admin > Asynchronous timed services
 * said "asyncservices not yet installed or other error ()" and never offered "crontab only", although the
 * crontab was there. Without popen it now reads the crontab file of its own user (Asyncservice::$crontab_dirs),
 * if that file is readable for it.
 *
 * Setup: installed() runs in a separate php process started with -d disable_functions=popen (it can not be
 * disabled at runtime), on an Asyncservice without constructor (no database needed), whose $crontab_dirs point
 * to a temporary directory holding a crontab file named after the current user.
 *
 * Pass: popen is really unavailable in that process; with our line in the file, installed() returns its times
 * and the line, other lines come back in $other_cronlines; without a readable file it returns False.
 *
 * Needs an executable /usr/bin/crontab (installed() returns 0 without one) and the posix extension.
 */
class AsyncserviceInstalledTest extends TestCase
{
	const CRONLINE = '/var/www/egroupware/api/asyncservices.php default';

	/**
	 * @var string temporary directory standing in for /etc/crontabs/
	 */
	protected $dir;

	protected function setUp() : void
	{
		if (!is_executable('/usr/bin/crontab') || !function_exists('posix_geteuid'))
		{
			$this->markTestSkipped('needs /usr/bin/crontab and the posix extension');
		}
		$this->dir = sys_get_temp_dir().'/asyncservice-installed-'.bin2hex(random_bytes(4));
		mkdir($this->dir);
	}

	protected function tearDown() : void
	{
		if ($this->dir)
		{
			array_map('unlink', glob($this->dir.'/*'));
			rmdir($this->dir);
		}
	}

	/**
	 * Run installed() in a php process without popen
	 *
	 * @return array with keys 'popen', 'installed' and 'other'
	 */
	protected function installedWithoutPopen() : array
	{
		$script = $this->dir.'/run-installed.php';	// no crontab file: its name is not a user's
		file_put_contents($script, '<?php
require $argv[1]."/vendor/autoload.php";
require $argv[1]."/api/src/loader/common.php";
$async = (new ReflectionClass(EGroupware\Api\Asyncservice::class))->newInstanceWithoutConstructor();
$async->cronline = $argv[2];
$async->crontab_dirs = [$argv[3]."/"];
$other = [];
echo json_encode(["popen" => function_exists("popen"), "installed" => $async->installed($other), "other" => $other]);
');
		// stderr apart: the deprecation notices of the old code must not end up in the json
		$errors = $this->dir.'/run-installed.err';
		$output = shell_exec(implode(' ', array_map('escapeshellarg', [
			PHP_BINARY, '-d', 'disable_functions=popen', $script, realpath(__DIR__.'/../..'), self::CRONLINE, $this->dir,
		])).' 2>'.escapeshellarg($errors));
		$result = json_decode((string)$output, true);
		$this->assertIsArray($result, "installed() did not run: $output\n".file_get_contents($errors));
		$this->assertFalse($result['popen'], 'popen is still available in the child process');
		return $result;
	}

	public function testReadsCrontabFileWithoutPopen()
	{
		$line = '*/3 * * * * /usr/local/bin/egw-async '.self::CRONLINE." cron >/dev/null 2>&1\n";
		$other = "0 2 * * * /usr/local/bin/some-backup\n";
		file_put_contents($this->dir.'/'.posix_getpwuid(posix_geteuid())['name'], $other.$line);

		$result = $this->installedWithoutPopen();

		$this->assertIsArray($result['installed'], 'crontab not found without popen');
		$this->assertSame($line, $result['installed']['cronline']);
		$this->assertSame('*/3', $result['installed']['min']);
		$this->assertSame('*', $result['installed']['dow']);
		$this->assertSame([$other], $result['other']);
	}

	public function testNoReadableCrontabFileIsNotInstalled()
	{
		$result = $this->installedWithoutPopen();

		$this->assertFalse($result['installed']);
	}
}
