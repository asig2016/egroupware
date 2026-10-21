<?php
/**
 * EGroupware Api: Backup::fopen_backup() - from where a backup is opened
 *
 * Since "harden backup to only accept filename without path" a name is looked up in the backup-dir only. The callers
 * that hand over a path of their own (setup's install from an uploaded backup, setup-cli.php) use fopen_backup_path():
 * an empty database has no backup-dir, and the uploaded /tmp/phpXXXX.bz2 became "/phpXXXX".
 *
 * @link https://www.egroupware.org
 * @package api
 * @subpackage db
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 */

namespace EGroupware\Api\Db;

use PHPUnit\Framework\TestCase;

class BackupTest extends TestCase
{
	/**
	 * A temp dir with the backup-dir and a folder elsewhere, both holding a file of the same name
	 *
	 * @var string
	 */
	private $dir;

	/**
	 * @var Backup
	 */
	private $backup;

	protected function setUp() : void
	{
		$this->dir = sys_get_temp_dir().'/backup-test-'.bin2hex(random_bytes(4));
		mkdir($this->dir.'/backup', 0700, true);
		mkdir($this->dir.'/elsewhere', 0700);
		file_put_contents($this->dir.'/backup/db_backup-209901010000', 'in the backup-dir');
		file_put_contents($this->dir.'/elsewhere/db_backup-209901010000', 'elsewhere');

		// fopen_backup() needs the backup-dir only, not the database the constructor connects to
		$this->backup = (new \ReflectionClass(Backup::class))->newInstanceWithoutConstructor();
		$this->backup->backup_dir = $this->dir.'/backup';
	}

	protected function tearDown() : void
	{
		foreach (['backup', 'elsewhere'] as $sub)
		{
			array_map('unlink', glob($this->dir.'/'.$sub.'/*'));
			rmdir($this->dir.'/'.$sub);
		}
		rmdir($this->dir);
	}

	private function read($f) : string
	{
		$this->assertIsResource($f);
		$content = stream_get_contents($f);
		fclose($f);
		return $content;
	}

	public function testPathIsOnlyANameInTheBackupDir()
	{
		$this->assertSame('in the backup-dir', $this->read($this->backup->fopen_backup($this->dir.'/elsewhere/db_backup-209901010000', true, false)),
			'fopen_backup(): a path only names a file in the backup-dir');
	}

	public function testRelativeNameStaysInTheBackupDir()
	{
		$this->assertSame('in the backup-dir', $this->read($this->backup->fopen_backup_path('../elsewhere/db_backup-209901010000', true, false)),
			'a relative name is never a path, also for fopen_backup_path()');
	}

	public function testFullPathIsUsedAsItIs()
	{
		$this->assertSame('elsewhere', $this->read($this->backup->fopen_backup_path($this->dir.'/elsewhere/db_backup-209901010000', true, false)));
	}

	public function testFullPathIsOnlyForThatCall()
	{
		$this->read($this->backup->fopen_backup_path($this->dir.'/elsewhere/db_backup-209901010000', true, false));
		$this->assertSame('in the backup-dir', $this->read($this->backup->fopen_backup($this->dir.'/elsewhere/db_backup-209901010000', true, false)));
	}

	/**
	 * A subclass overriding fopen_backup() with its signature (as Stylite's S3 backup does) still loads: a fourth
	 * parameter there was a fatal error for the whole of setup/db_backup.php
	 */
	public function testSubclassWithTheSignatureLoads()
	{
		$sub = new class extends Backup
		{
			public function __construct() { }

			public function fopen_backup(?string $name = null, bool $reading = false, bool $un_compress = true)
			{
				return parent::fopen_backup($name, $reading, $un_compress);
			}
		};
		$sub->backup_dir = $this->dir.'/backup';
		$this->assertSame('elsewhere', $this->read($sub->fopen_backup_path($this->dir.'/elsewhere/db_backup-209901010000', true, false)));
	}

	public function testUploadedBackupOfAnEmptyDatabase()
	{
		if (!function_exists('bzopen'))
		{
			$this->markTestSkipped('needs the bz2 extension');
		}
		// setup/index.php renames the upload to its extension: /tmp/phpXXXX.bz2 - and an empty database has no backup-dir
		$upload = $this->dir.'/elsewhere/phpAbC123.bz2';
		file_put_contents('compress.bzip2://'.$upload, "charset: utf-8\n");
		$this->backup->backup_dir = '';
		$this->assertSame("charset: utf-8\n", $this->read($this->backup->fopen_backup_path($upload, true)));
	}
}
