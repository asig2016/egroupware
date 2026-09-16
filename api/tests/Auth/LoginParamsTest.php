<?php
/**
 * EGroupware Api: tests for what the login page takes from the request and keeps across a SSO login
 *
 * @link https://www.egroupware.org
 * @package api
 * @subpackage test
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 */

namespace EGroupware\Api\Auth;

use EGroupware\Api\Auth;
use EGroupware\Api\Html;
use PHPUnit\Framework\TestCase;

/**
 * Auth::selectedLang(), Auth::loginParams() and Auth::isLocalForward() only read the request and the
 * session, so no login is needed. All three run on the login page, before anyone is authenticated.
 */
class LoginParamsTest extends TestCase
{
	protected $backup;

	protected function setUp() : void
	{
		$this->backup = [$_GET, $_POST, $_REQUEST, $_SESSION ?? null];
		$_GET = $_POST = $_REQUEST = $_SESSION = [];
	}

	protected function tearDown() : void
	{
		[$_GET, $_POST, $_REQUEST, $_SESSION] = $this->backup;
	}

	public function testSelectedLangOnlyTakesALanguageCode()
	{
		$_POST['lang'] = 'de';
		$this->assertEquals('de', Auth::selectedLang());

		$_POST['lang'] = 'pt-br';
		$this->assertEquals('pt-br', Auth::selectedLang());

		$_POST['lang'] = 'de"><script>';
		$this->assertNull(Auth::selectedLang());

		$_POST['lang'] = ['de'];
		$this->assertNull(Auth::selectedLang());
	}

	public function testSelectedLangFallsBackToTheRememberedOneOnlyWhenAsked()
	{
		$_SESSION[Auth::LOGIN_LANG] = 'fr';
		$this->assertNull(Auth::selectedLang());
		$this->assertEquals('fr', Auth::selectedLang(true));

		$_GET['lang'] = 'it';
		$this->assertEquals('it', Auth::selectedLang(true), 'the request wins over the session');
	}

	public function testLoginParamsOnlyTakesPhpgwNames()
	{
		$_REQUEST = [
			'phpgw_forward' => '/index.php?menuaction=calendar.calendar_uiviews.index',
			'phpgw_forward"><script>alert(1)</script>' => 'x',
			'passwd' => 'secret',
			'phpgw_array' => ['x'],
		];
		$this->assertEquals(['phpgw_forward' => '/index.php?menuaction=calendar.calendar_uiviews.index'],
			Auth::loginParams());
	}

	/**
	 * login() keeps them in the session of a request nobody authenticated yet
	 */
	public function testLoginParamsAreLimitedInNumberAndLength()
	{
		for($i = 0; $i < 50; $i++)
		{
			$_REQUEST['phpgw_p'.$i] = 'value';
		}
		$_REQUEST['phpgw_long'] = str_repeat('x', Auth::LOGIN_PARAMS_MAX_LENGTH + 1);

		$params = Auth::loginParams();
		$this->assertCount(Auth::LOGIN_PARAMS_MAX, $params);
		$this->assertArrayNotHasKey('phpgw_long', $params);
	}

	public function testLoginParamsFallBackToTheRememberedOnesOnlyWhenAsked()
	{
		$_SESSION[Auth::LOGIN_PARAMS] = ['phpgw_forward' => '/remembered'];
		$this->assertEquals([], Auth::loginParams());
		$this->assertEquals(['phpgw_forward' => '/remembered'], Auth::loginParams(true));

		$_REQUEST['phpgw_forward'] = '/requested';
		$this->assertEquals(['phpgw_forward' => '/requested'], Auth::loginParams(true));
	}

	#[\PHPUnit\Framework\Attributes\DataProvider('forwardProvider')]
	public function testIsLocalForward(string $forward, bool $local)
	{
		$this->assertSame($local, Auth::isLocalForward($forward));
	}

	public static function forwardProvider() : array
	{
		return [
			['/index.php?menuaction=calendar.calendar_uiviews.index&cd=yes', true],
			['index.php', true],
			['/openid/endpoint.php/authorize?client_id=x&redirect_uri=https://example.org/', true],
			['//evil.example', false],
			['/\\evil.example', false],
			['\\\\evil.example', false],
			["/\t/evil.example", false],
			["  //evil.example", false],
			['https://evil.example', false],
			['javascript:alert(1)', false],
		];
	}

	public function testInputHiddenEscapesTheName()
	{
		$html = Html::input_hidden(['phpgw_x"><script>' => 'a"b']);

		$this->assertStringNotContainsString('<script>', $html);
		$this->assertStringContainsString('name="phpgw_x&quot;&gt;&lt;script&gt;"', $html);
		$this->assertStringContainsString('value="a&quot;b"', $html);
	}
}
