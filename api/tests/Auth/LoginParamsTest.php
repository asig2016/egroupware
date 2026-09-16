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
		$_SESSION[Auth::LOGIN_STASHED] = time();
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
			'phpgw_Forward' => '/other',
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
		$_SESSION[Auth::LOGIN_STASHED] = time();
		$this->assertEquals([], Auth::loginParams());
		$this->assertEquals(['phpgw_forward' => '/remembered'], Auth::loginParams(true));

		$_REQUEST['phpgw_forward'] = '/requested';
		$this->assertEquals(['phpgw_forward' => '/requested'], Auth::loginParams(true));
	}

	/**
	 * What an abandoned SSO login remembered must not forward a much later login
	 */
	public function testRememberedValuesExpire()
	{
		$_SESSION[Auth::LOGIN_LANG] = 'fr';
		$_SESSION[Auth::LOGIN_PARAMS] = ['phpgw_forward' => '/remembered'];
		$_SESSION[Auth::LOGIN_STASHED] = time() - Auth::LOGIN_STASH_TTL - 1;

		$this->assertNull(Auth::selectedLang(true));
		$this->assertEquals([], Auth::loginParams(true));

		$_SESSION[Auth::LOGIN_STASHED] = time();
		Auth::clearLoginStash();
		$this->assertEquals([], Auth::loginParams(true));
		$this->assertArrayNotHasKey(Auth::LOGIN_LANG, $_SESSION);
		$this->assertArrayNotHasKey(Auth::LOGIN_STASHED, $_SESSION);
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
			['calendar/index.php', true],
			['/index.php?query=a\\b', true],
			['/openid/endpoint.php/authorize?client_id=x&redirect_uri=https://example.org/', true],
			['//evil.example', false],
			['/\\evil.example', false],
			['\\\\evil.example', false],
			['\\evil.example', false],
			["\t\\evil.example", false],
			["\x0b\\evil.example", false],
			[' /index.php', false],
			["/\t/evil.example", false],
			["  //evil.example", false],
			['https://evil.example', false],
			['javascript:alert(1)', false],
		];
	}

	/**
	 * The URL the login redirects to, for every kind of webserver_url - the one place a browser decides
	 */
	#[\PHPUnit\Framework\Attributes\DataProvider('redirectProvider')]
	public function testLoginRedirectStaysOnThisServer(string $forward)
	{
		$backup = $GLOBALS['egw_info'] ?? null;
		try
		{
			foreach(['', '/', '/egroupware'] as $webserver_url)
			{
				$GLOBALS['egw_info'] = ['flags' => ['currentapp' => 'login'], 'server' => ['webserver_url' => $webserver_url]];
				$_GET = ['phpgw_forward' => $forward];
				[$url, $extra_vars] = Auth::loginForward();
				try
				{
					$link = \EGroupware\Api\Session::link($url, $extra_vars);
				}
				catch (\InvalidArgumentException $e)
				{
					continue;	// refused to link outside, fine too
				}
				$this->assertMatchesRegularExpression('#^/(?![/\\\\])#', str_replace(["\t", "\r", "\n"], '', $link),
					"webserver_url='$webserver_url': ".json_encode($forward)." links to ".json_encode($link));
			}
		}
		finally
		{
			$GLOBALS['egw_info'] = $backup;
		}
	}

	public static function redirectProvider() : array
	{
		return array_map(fn($forward) => [$forward], [
			'/index.php?menuaction=calendar.calendar_uiviews.index',
			'index.php',
			'\\evil.example',
			"\t\\evil.example",
			'/\\evil.example',
			'//evil.example',
			'https://evil.example',
			'%5Cevil.example',
		]);
	}

	public function testInputHiddenEscapesTheName()
	{
		$html = Html::input_hidden(['phpgw_x"><script>' => 'a"b']);

		$this->assertStringNotContainsString('<script>', $html);
		$this->assertStringContainsString('name="phpgw_x&quot;&gt;&lt;script&gt;"', $html);
		$this->assertStringContainsString('value="a&quot;b"', $html);
	}
}
