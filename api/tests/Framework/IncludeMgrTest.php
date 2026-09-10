<?php
/**
 * Tests for Api\Framework\IncludeMgr - hashed build entries without a literal file
 *
 * @link https://www.egroupware.org
 * @package api
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 */

namespace EGroupware\Api\Framework;

use PHPUnit\Framework\TestCase;
use ReflectionProperty;

/**
 * Contract under test
 *
 * Since rollup hashes its entries (a77de36152) `/<app>/js/app.min.js` and
 * `/api/js/etemplate/etemplate2.js` no longer exist under their literal names: the file is
 * `chunks/<app>-js-app.min-<hash>.js` and api/js/build-manifest.json maps the logical name to it.
 * Bundle::js_includes() passes such an entry through as its bare logical path and egw_import()
 * resolves it client-side against the manifest stamped into the page.
 *
 * IncludeMgr::translate_params() sat in front of all that with an is_readable() on the literal
 * path, so kdots_framework's `includeJS('/kdots/js/app.min.js')` was silently dropped on a tree
 * without a leftover stub - the page's data-include carried no framework bundle and the site hung
 * on the splash with "framework is not defined" (dev5, 2026-09-10). A manifest-known entry must
 * be includable whether or not something happens to sit at its literal path.
 */
class IncludeMgrTest extends TestCase
{
	/** logical entry that exists in no tree, only in the injected manifest */
	const ENTRY = '/zz_includemgr_test/js/app.min.js';

	private $manifest_backup;

	protected function setUp() : void
	{
		$prop = new ReflectionProperty(Bundle::class, 'manifest');
		$prop->setAccessible(true);
		$this->manifest_backup = $prop->getValue();
		$prop->setValue(null, [self::ENTRY => '/chunks/zz_includemgr_test-js-app.min-0123abcd.js']);
	}

	protected function tearDown() : void
	{
		$prop = new ReflectionProperty(Bundle::class, 'manifest');
		$prop->setAccessible(true);
		$prop->setValue(null, $this->manifest_backup);
	}

	public function testManifestEntryIsIncludedWithoutLiteralFile()
	{
		$this->assertFileDoesNotExist(EGW_SERVER_ROOT.self::ENTRY, 'test precondition');

		$mgr = new IncludeMgr();
		$mgr->include_js_file(self::ENTRY);

		$this->assertSame([self::ENTRY], $mgr->get_included_files(),
			'a manifest-known entry is included under its logical path, no literal file needed');
	}

	public function testManifestEntryWithCacheBusterIsRecognised()
	{
		$mgr = new IncludeMgr();
		$mgr->include_js_file(self::ENTRY.'?12345');

		// the manifest is looked up by path only and the entry is recorded under that path:
		// the client resolves it against the manifest, whose hashed name is the cache-buster
		$this->assertSame([self::ENTRY], $mgr->get_included_files());
	}

	public function testUnknownMissingFileIsStillDropped()
	{
		$mgr = new IncludeMgr();
		$mgr->include_js_file('/zz_includemgr_test/js/nothere.js');

		$this->assertSame([], $mgr->get_included_files(),
			'a path neither on disk nor in the manifest is not included, exactly as before');
	}

	public function testExistingFileStillIncluded()
	{
		$mgr = new IncludeMgr();
		$mgr->include_js_file('/api/js/jsapi/egw_json.ts');

		$this->assertSame(['/api/js/jsapi/egw_json.ts'], $mgr->get_included_files(),
			'the literal-file path is untouched');
	}
}
