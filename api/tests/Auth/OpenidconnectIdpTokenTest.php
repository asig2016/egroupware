<?php
/**
 * EGroupware API - the provider's tokens of the SSO login, kept for $token mounts on it (PATCH CORE)
 *
 * CONTRACT UNDER TEST
 * Auth\Openidconnect keeps the provider's access and refresh token of a login (only when setup
 * asks for additional scopes) and idpAccessToken() hands the access token out again, refreshed
 * when it lives less than IDP_TOKEN_MIN_LIFETIME. The tokens belong to the account AND the
 * session id they were kept for: the session data outlives a logout and a new login in the same
 * browser, so a different session id or account gets nothing and drops them. logout() drops
 * them. The refresh token is stored encrypted and rotates: the provider's new one is kept. A
 * refused refresh, or an expired token without a refresh token, drops them.
 *
 * SETUP STRATEGY
 * A subclass whose constructor puts a fake OpenID Connect client in place: its refreshToken()
 * records the refresh token it got and returns a canned response - no provider, no network.
 * Tokens are stored through the class's own storeIdpTokens(); the session id is swapped to
 * play "the next login in this browser".
 *
 * PASS CRITERIA
 * The token handed out per case, the refresh tokens the provider was sent, and whether the
 * kept tokens are still there.
 *
 * @package api
 * @subpackage tests
 */

namespace EGroupware\Api\Auth;

require_once __DIR__ . '/../LoggedInTest.php';

use EGroupware\Api;
use EGroupware\Api\LoggedInTest;
use Jumbojett\OpenIDConnectClient;

class OpenidconnectIdpTokenTest extends LoggedInTest
{
	private ?string $sessionid_backup = null;
	private $scopes_backup;

	protected function setUp(): void
	{
		parent::setUp();
		$this->sessionid_backup = $GLOBALS['egw']->session->sessionid;
		$this->scopes_backup = $GLOBALS['egw_info']['server'][Openidconnect::CONFIG_LOGIN_SCOPES] ?? null;
		IdpTokenTestBackend::$refreshed = [];
		IdpTokenTestBackend::$response = null;
		Openidconnect::forgetIdpTokens();
	}

	protected function tearDown(): void
	{
		Openidconnect::forgetIdpTokens();
		$GLOBALS['egw']->session->sessionid = $this->sessionid_backup;
		if ($this->scopes_backup === null) unset($GLOBALS['egw_info']['server'][Openidconnect::CONFIG_LOGIN_SCOPES]);
		else $GLOBALS['egw_info']['server'][Openidconnect::CONFIG_LOGIN_SCOPES] = $this->scopes_backup;
		parent::tearDown();
	}

	/** a JWT-shaped access token expiring in $seconds */
	private static function jwt(int $seconds, string $tag='a'): string
	{
		$payload = rtrim(strtr(base64_encode(json_encode(['exp' => time() + $seconds, 'sub' => 'someone'])), '+/', '-_'), '=');
		return 'eyJhbGciOiJSUzI1NiJ9.'.$payload.'.sig-'.$tag;
	}

	public function testValidTokenIsHandedOutWithoutRefresh()
	{
		$token = self::jwt(3600);
		IdpTokenTestBackend::store($token, 'refresh-1', 'someone');
		$this->assertSame($token, IdpTokenTestBackend::idpAccessToken($why));
		$this->assertNull($why);
		$this->assertSame([], IdpTokenTestBackend::$refreshed);
	}

	public function testRefreshTokenIsStoredEncrypted()
	{
		IdpTokenTestBackend::store(self::jwt(3600), 'refresh-secret-1', 'someone');
		$kept = Api\Cache::getSession(Openidconnect::class, Openidconnect::IDP_TOKENS);
		$this->assertNotEmpty($kept['refresh']);
		$this->assertStringNotContainsString('refresh-secret-1', serialize($kept));
	}

	/**
	 * The session data outlives logout and a new login in the same browser - the new session id
	 * must not see the previous user's tokens, and the attempt drops them
	 */
	public function testAnotherSessionGetsNothingAndDropsThem()
	{
		IdpTokenTestBackend::store(self::jwt(3600), 'refresh-1', 'someone');
		$GLOBALS['egw']->session->sessionid = 'the-next-login-'.uniqid();

		$this->assertSame('', IdpTokenTestBackend::idpAccessToken($why));
		$this->assertStringContainsString('another login', $why);
		$this->assertNull(Api\Cache::getSession(Openidconnect::class, Openidconnect::IDP_TOKENS), 'dropped');

		// and the original session does not get them back either
		$GLOBALS['egw']->session->sessionid = $this->sessionid_backup;
		$this->assertSame('', IdpTokenTestBackend::idpAccessToken());
	}

	public function testAnotherAccountGetsNothing()
	{
		IdpTokenTestBackend::store(self::jwt(3600), 'refresh-1', 'someone');
		$kept = Api\Cache::getSession(Openidconnect::class, Openidconnect::IDP_TOKENS);
		$kept['account_id'] = $kept['account_id'] + 1000000;
		Api\Cache::setSession(Openidconnect::class, Openidconnect::IDP_TOKENS, $kept);

		$this->assertSame('', IdpTokenTestBackend::idpAccessToken($why));
		$this->assertStringContainsString('another login', $why);
	}

	public function testForgetDropsThem()
	{
		IdpTokenTestBackend::store(self::jwt(3600), 'refresh-1', 'someone');
		Openidconnect::forgetIdpTokens();   // what logout() does
		$this->assertSame('', IdpTokenTestBackend::idpAccessToken($why));
		$this->assertStringContainsString('log in through the provider', $why);
	}

	/**
	 * Less than IDP_TOKEN_MIN_LIFETIME left: refreshed, and the rotated refresh token is the one
	 * sent next time
	 */
	public function testRefreshRotatesTheRefreshToken()
	{
		IdpTokenTestBackend::store(self::jwt(60, 'old'), 'refresh-1', 'someone');
		$new = self::jwt(3600, 'new');
		IdpTokenTestBackend::$response = (object)['access_token' => $new, 'refresh_token' => 'refresh-2'];

		$this->assertSame($new, IdpTokenTestBackend::idpAccessToken());
		$this->assertSame(['refresh-1'], IdpTokenTestBackend::$refreshed);

		// the new token is valid long enough: no refresh
		$this->assertSame($new, IdpTokenTestBackend::idpAccessToken());
		$this->assertSame(['refresh-1'], IdpTokenTestBackend::$refreshed);

		// expire it: the rotated refresh token goes to the provider
		$kept = Api\Cache::getSession(Openidconnect::class, Openidconnect::IDP_TOKENS);
		$kept['exp'] = time() + 10;
		Api\Cache::setSession(Openidconnect::class, Openidconnect::IDP_TOKENS, $kept);
		IdpTokenTestBackend::$response = (object)['access_token' => self::jwt(3600, 'newer')];
		IdpTokenTestBackend::idpAccessToken();
		$this->assertSame(['refresh-1', 'refresh-2'], IdpTokenTestBackend::$refreshed);
	}

	public function testRefusedRefreshDropsThem()
	{
		IdpTokenTestBackend::store(self::jwt(60), 'refresh-1', 'someone');
		IdpTokenTestBackend::$response = (object)['error' => 'invalid_grant'];

		$this->assertSame('', IdpTokenTestBackend::idpAccessToken($why));
		$this->assertStringContainsString('invalid_grant', $why);
		$this->assertNull(Api\Cache::getSession(Openidconnect::class, Openidconnect::IDP_TOKENS));
	}

	public function testExpiredWithoutRefreshTokenDropsThem()
	{
		IdpTokenTestBackend::store(self::jwt(60), '', 'someone');
		$this->assertSame('', IdpTokenTestBackend::idpAccessToken($why));
		$this->assertStringContainsString('no refresh token', $why);
		$this->assertSame([], IdpTokenTestBackend::$refreshed);
		$this->assertNull(Api\Cache::getSession(Openidconnect::class, Openidconnect::IDP_TOKENS));
	}

	public function testLoginScopesAreScopeNamesOnly()
	{
		$GLOBALS['egw_info']['server'][Openidconnect::CONFIG_LOGIN_SCOPES] = ' app-filemanager, app-infolog  bad"scope ';
		$this->assertSame(['app-filemanager', 'app-infolog'], Openidconnect::loginScopes());
		unset($GLOBALS['egw_info']['server'][Openidconnect::CONFIG_LOGIN_SCOPES]);
		$this->assertSame([], Openidconnect::loginScopes());
	}
}

/**
 * The backend with a fake client: refreshToken() records and answers from $response
 */
class IdpTokenTestBackend extends Openidconnect
{
	public static array $refreshed = [];
	public static $response;

	public function __construct()
	{
		$this->client = new class('https://idp.example.invalid', 'test-client', 'secret') extends OpenIDConnectClient
		{
			public function refreshToken($refresh_token)
			{
				IdpTokenTestBackend::$refreshed[] = $refresh_token;
				return IdpTokenTestBackend::$response ?? (object)[];
			}
		};
	}

	public static function store(string $access, string $refresh, string $sub): void
	{
		static::storeIdpTokens($access, $refresh, $sub);
	}
}
