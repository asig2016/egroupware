<?php
/**
 * EGroupware API - access tokens of the OpenID Connect provider as Bearer token (PATCH CORE)
 *
 * CONTRACT UNDER TEST
 * Auth\Openidconnect::accountFromClaims() judges the claims of a signature-verified access token
 * and names the account it logs in, with the session limits it carries. Every rule is hard:
 * not expired, not before its time, not older than MAX_TOKEN_AGE, issued for this client
 * ("aud"), by the configured provider ("iss", when set), with at least one app-* scope (those
 * become the limits, plus 'api'), naming an existing user account by setup's username rules -
 * the token names the user, nothing else is asked. acceptsAccessTokens() is off unless setup
 * says so AND OpenID Connect is the authentication type. looksLikeJWT() gates the attempt.
 *
 * SETUP STRATEGY
 * Claims built by hand around the logged-in test user for the rules; for the whole accepting
 * path, accountFromAccessToken(), a token signed with a key generated on the spot and the
 * real verification client (AccessTokenClient) with its HTTP fetch replaced by the matching
 * discovery document and JWKS: no network, no provider. Setup's options pinned for the test
 * and restored afterwards, the client's document cache emptied first.
 *
 * PASS CRITERIA
 * The account name and limits for a good token; null for each broken rule, one per test.
 *
 * @package api
 * @subpackage tests
 */

namespace EGroupware\Api\Auth;

require_once __DIR__ . '/../LoggedInTest.php';

use EGroupware\Api;
use EGroupware\Api\LoggedInTest;

class OpenidconnectAccessTokenTest extends LoggedInTest
{
	const CLIENT = 'test-client';
	const ISSUER = 'https://idp.example.invalid';

	private array $server_backup = [];
	private array $request_backup = [];
	private int $now;

	protected function setUp(): void
	{
		parent::setUp();
		$this->now = time();
		foreach (['oic_username_attribute', 'oic_username_custom', 'oic_username_preg', 'oic_email_unverified',
			Openidconnect::CONFIG_ACCESS_TOKENS, Openidconnect::CONFIG_ACCESS_TOKEN_ENDPOINTS, 'oic_provider', 'oic_client_id', 'oic_client_secret',
			'auth_type', 'auth_type_host', 'openidconnect_discovery', 'enforce_ssl'] as $key)
		{
			$this->server_backup[$key] = $GLOBALS['egw_info']['server'][$key] ?? null;
		}
		foreach (['SCRIPT_NAME', 'HTTPS', 'SERVER_PORT', 'HTTP_X_FORWARDED_PROTO', 'REMOTE_ADDR'] as $key)
		{
			$this->request_backup[$key] = $_SERVER[$key] ?? null;
			unset($_SERVER[$key]);
		}
		unset($GLOBALS['egw_info']['server']['enforce_ssl']);
		$GLOBALS['egw_info']['server']['oic_username_attribute'] = 'sub';
		unset($GLOBALS['egw_info']['server']['oic_username_preg'], $GLOBALS['egw_info']['server']['oic_username_custom']);
	}

	protected function tearDown(): void
	{
		foreach ($this->server_backup as $key => $value)
		{
			if ($value === null)
			{
				unset($GLOBALS['egw_info']['server'][$key]);
			}
			else
			{
				$GLOBALS['egw_info']['server'][$key] = $value;
			}
		}
		foreach ($this->request_backup as $key => $value)
		{
			if ($value === null)
			{
				unset($_SERVER[$key]);
			}
			else
			{
				$_SERVER[$key] = $value;
			}
		}
		AccessTokenClient::$fetch = null;
		parent::tearDown();
	}

	/**
	 * A good token for the logged-in user
	 */
	private function claims(array $override = []): array
	{
		return $override + [
			'sub' => $GLOBALS['egw_info']['user']['account_lid'],
			'aud' => [self::CLIENT],
			'iss' => self::ISSUER,
			'iat' => $this->now - 10,
			'nbf' => $this->now - 10,
			'exp' => $this->now + 600,
			'jti' => 'test',
			'scopes' => ['app-filemanager'],
		];
	}

	private function account(array $claims, ?array &$limits = null): ?string
	{
		return Openidconnect::accountFromClaims($claims, self::CLIENT, self::ISSUER, $limits, $this->now);
	}

	public function testGoodTokenNamesTheUserWithItsAppsAsLimits()
	{
		$lid = $GLOBALS['egw_info']['user']['account_lid'];
		$this->assertSame($lid, $this->account($this->claims(), $limits));
		$this->assertSame(['api' => true, 'filemanager' => true], $limits);

		// several app scopes, also given as one space-separated "scope" claim
		$this->assertSame($lid, $this->account($this->claims(['scopes' => null, 'scope' => 'openid app-filemanager app-infolog']), $limits));
		$this->assertSame(['api' => true, 'filemanager' => true, 'infolog' => true], $limits);
	}

	public function testExpiredNotYetValidAndTooOldTokensAreRefused()
	{
		$this->assertNull($this->account($this->claims(['exp' => $this->now - 1])), 'expired');
		$this->assertNull($this->account($this->claims(['nbf' => $this->now + 3600])), 'not yet valid');
		$this->assertNull($this->account($this->claims(['iat' => $this->now - Openidconnect::MAX_TOKEN_AGE - 1])), 'older than the ceiling');
		$this->assertNull($this->account($this->claims(['iat' => $this->now + 3600])), 'issued in the future');
		$this->assertNull($this->account($this->claims(['iat' => null])), 'no iat, no age to judge');
	}

	public function testTokenForAnotherClientOrProviderIsRefused()
	{
		$this->assertNull($this->account($this->claims(['aud' => ['other-client']])), 'aud');
		$this->assertNull($this->account($this->claims(['aud' => null])), 'no aud');
		$this->assertNull($this->account($this->claims(['iss' => 'https://evil.example.invalid'])), 'iss');
		// a provider that sets no iss is judged by its signature alone; a path or case on the
		// configured url does not matter
		$lid = $GLOBALS['egw_info']['user']['account_lid'];
		$this->assertSame($lid, $this->account($this->claims(['iss' => null])));
		$this->assertSame($lid, Openidconnect::accountFromClaims($this->claims(['iss' => 'https://IDP.example.invalid/']),
			self::CLIENT, self::ISSUER.'/egroupware', $limits, $this->now));
	}

	public function testTokenWithoutAppScopeIsRefused()
	{
		$this->assertNull($this->account($this->claims(['scopes' => ['openid', 'profile']])), 'no app-* scope: a full-API token is no password');
		$this->assertNull($this->account($this->claims(['scopes' => []])));
		$this->assertNull($this->account($this->claims(['scopes' => ['app-']])), 'app- with no name');
	}

	public function testTokenMustNameAnExistingUser()
	{
		$this->assertNull($this->account($this->claims(['sub' => 'no-such-user-'.uniqid()])), 'unknown user');
		$this->assertNull($this->account($this->claims(['sub' => ''])), 'empty username');
	}

	public function testUsernameRulesOfSetupApply()
	{
		$lid = $GLOBALS['egw_info']['user']['account_lid'];
		// the regular expression strips a realm, as it does for the browser login
		$GLOBALS['egw_info']['server']['oic_username_preg'] = '/^(.*)@example\.invalid$/';
		$this->assertSame($lid, $this->account($this->claims(['sub' => $lid.'@example.invalid'])));
		unset($GLOBALS['egw_info']['server']['oic_username_preg']);

		// a custom claim
		$GLOBALS['egw_info']['server']['oic_username_attribute'] = 'custom';
		$GLOBALS['egw_info']['server']['oic_username_custom'] = 'login';
		$this->assertSame($lid, $this->account($this->claims(['sub' => 'someone', 'login' => $lid])));

	}

	/**
	 * The email claim: only a verified one, unless setup allows unverified ones
	 */
	public function testEmailAsUsernameMustBeVerified()
	{
		$lid = $GLOBALS['egw_info']['user']['account_lid'];
		$email = (string)($GLOBALS['egw_info']['user']['account_email'] ?? '');
		if ($email === '')
		{
			$this->markTestSkipped('the test user has no email address to map by');
		}
		$GLOBALS['egw_info']['server']['oic_username_attribute'] = 'email';
		unset($GLOBALS['egw_info']['server']['oic_email_unverified']);
		$this->assertNull($this->account($this->claims(['sub' => 'x', 'email' => $email, 'email_verified' => false])), 'unverified email');
		$this->assertSame($lid, $this->account($this->claims(['sub' => 'x', 'email' => $email, 'email_verified' => true])));
	}

	/**
	 * The whole accepting path: signature against the provider's keys, then the claims
	 *
	 * A token under the published key is accepted, its claims served from the cache after that,
	 * and the provider's documents are fetched once for any number of tokens and requests;
	 * a tampered payload and a foreign key are refused and remembered, bad claims under a good
	 * signature are refused but not remembered as a bad signature.
	 */
	public function testSignedTokenIsVerifiedAgainstTheProvidersKeys()
	{
		$lid = $GLOBALS['egw_info']['user']['account_lid'];
		$b64 = fn(string $bin) => rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
		$newKey = fn() => openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
		$sign = function(array $claims, $key) use ($b64)
		{
			$data = $b64(json_encode(['typ' => 'JWT', 'alg' => 'RS256'])).'.'.$b64(json_encode($claims));
			$this->assertTrue(openssl_sign($data, $signature, $key, OPENSSL_ALGO_SHA256));
			return $data.'.'.$b64($signature);
		};
		$key = $newKey();
		$this->assertNotFalse($key, 'openssl can generate a key');
		$rsa = openssl_pkey_get_details($key)['rsa'];
		$jwks = json_encode(['keys' => [['kty' => 'RSA', 'alg' => 'RS256', 'use' => 'sig', 'kid' => 'test',
			'n' => $b64($rsa['n']), 'e' => $b64($rsa['e'])]]]);
		$discovery = json_encode(['issuer' => self::ISSUER, 'jwks_uri' => self::ISSUER.'/jwks']);
		$fetches = [];
		AccessTokenClient::$fetch = function(string $url) use (&$fetches, $discovery, $jwks)
		{
			$fetches[] = $url;
			return str_ends_with($url, '/jwks') ? $jwks : $discovery;
		};
		foreach ([self::ISSUER.'/.well-known/openid-configuration', self::ISSUER.'/jwks'] as $url)
		{
			Api\Cache::unsetInstance(AccessTokenClient::class, AccessTokenClient::cacheKey($url));
		}
		$GLOBALS['egw_info']['server']['oic_provider'] = self::ISSUER;
		$GLOBALS['egw_info']['server']['oic_client_id'] = self::CLIENT;
		$GLOBALS['egw_info']['server']['oic_client_secret'] = 'unused';

		$oic = new Openidconnect();
		$jwt = $sign($this->claims(), $key);
		$this->assertSame($lid, $oic->accountFromAccessToken($jwt, $limits));
		$this->assertSame(['api' => true, 'filemanager' => true], $limits);
		$this->assertCount(2, $fetches, 'the discovery document and the keys, once each');
		// verified claims come from the cache: nothing verified or fetched for the same token
		$this->assertSame($lid, $oic->accountFromAccessToken($jwt, $limits));
		$this->assertCount(2, $fetches);
		// another token in another request (a new object): the documents come from the cache
		$second = $sign($this->claims(['jti' => 'second']), $key);
		$this->assertSame($lid, (new Openidconnect())->accountFromAccessToken($second, $limits));
		$this->assertCount(2, $fetches, 'no request to the provider for a second token');
		$this->assertFalse(Openidconnect::rejectedRecently($jwt));

		[$header, , $signature] = explode('.', $jwt);
		$tampered = $header.'.'.$b64(json_encode($this->claims(['scopes' => ['app-filemanager', 'app-admin']]))).'.'.$signature;
		$this->assertNull($oic->accountFromAccessToken($tampered, $limits), 'a tampered payload');
		$this->assertTrue(Openidconnect::rejectedRecently($tampered), 'and remembered');
		$foreign = $sign($this->claims(), $newKey());
		$this->assertNull($oic->accountFromAccessToken($foreign, $limits), 'a foreign key');
		$this->assertTrue(Openidconnect::rejectedRecently($foreign));
		$bad = $sign($this->claims(['aud' => ['other-client']]), $key);
		$this->assertNull($oic->accountFromAccessToken($bad, $limits), 'bad claims under a good signature');
		$this->assertFalse(Openidconnect::rejectedRecently($bad), 'the signature was fine: judged, not remembered');
		$this->assertCount(2, $fetches, 'all of that without another request to the provider');
		$this->assertSame([], Openidconnect::claimsOf('not.a.jwt'), 'no JSON: no claims');

		// an HMAC under the client secret, which the vendor client would accept: not an asymmetric signature
		$data = $b64(json_encode(['typ' => 'JWT', 'alg' => 'HS256'])).'.'.$b64(json_encode($this->claims()));
		$hmac = $data.'.'.$b64(hash_hmac('sha256', $data, 'unused', true));
		$this->assertNull($oic->accountFromAccessToken($hmac, $limits), 'HS256 under the client secret');
		$this->assertTrue(Openidconnect::rejectedRecently($hmac));
		$none = $b64(json_encode(['typ' => 'JWT', 'alg' => 'none'])).'.'.$b64(json_encode($this->claims())).'.';
		$this->assertNull($oic->accountFromAccessToken($none, $limits), 'alg none');
		$this->assertSame('HS256', Openidconnect::headerOf($hmac)['alg']);

		// the one call of the header handler: the Bearer token opens an open door only
		$GLOBALS['egw_info']['server'][Openidconnect::CONFIG_ACCESS_TOKENS] = 'true';
		$GLOBALS['egw_info']['server']['auth_type'] = 'openidconnect';
		$_SERVER['HTTPS'] = 'on';
		$_SERVER['SCRIPT_NAME'] = '/egroupware/webdav.php';
		$this->assertSame($lid, Openidconnect::accountFromBearer($jwt, $limits));
		$this->assertSame(['api' => true, 'filemanager' => true], $limits);
		$this->assertNull(Openidconnect::accountFromBearer('token12_0123456789abcdef', $limits), 'an EGroupware token is no JWT');
		$_SERVER['SCRIPT_NAME'] = '/egroupware/json.php';
		$this->assertNull(Openidconnect::accountFromBearer($jwt, $limits), 'not at json.php');
		$_SERVER['SCRIPT_NAME'] = '/egroupware/webdav.php';
		$_SERVER['HTTPS'] = 'off';
		$this->assertNull(Openidconnect::accountFromBearer($jwt, $limits), 'not in the clear');
	}

	/**
	 * A token opens webdav.php over https; groupdav.php only when setup opens it; nothing else
	 */
	public function testTokensOpenWebDAVOverHttpsUnlessSetupOpensMore()
	{
		$GLOBALS['egw_info']['server'][Openidconnect::CONFIG_ACCESS_TOKENS] = 'true';
		$GLOBALS['egw_info']['server']['oic_provider'] = self::ISSUER;
		$GLOBALS['egw_info']['server']['oic_client_id'] = self::CLIENT;
		$GLOBALS['egw_info']['server']['auth_type'] = 'openidconnect';
		unset($GLOBALS['egw_info']['server'][Openidconnect::CONFIG_ACCESS_TOKEN_ENDPOINTS]);

		$this->assertTrue(Openidconnect::acceptsAccessTokensHere('/egroupware/webdav.php', 'https'));
		$this->assertFalse(Openidconnect::acceptsAccessTokensHere('/egroupware/webdav.php', 'http', $why), 'in the clear');
		$this->assertStringContainsString('https', $why);
		$this->assertFalse(Openidconnect::acceptsAccessTokensHere('/egroupware/groupdav.php', 'https', $why), 'CalDAV is closed by default');
		$this->assertStringContainsString('groupdav.php', $why);
		foreach (['/egroupware/json.php', '/egroupware/api/changepwd.php', '/egroupware/remote.php', ''] as $script)
		{
			$this->assertFalse(Openidconnect::acceptsAccessTokensHere($script, 'https'), "$script never");
		}
		$GLOBALS['egw_info']['server'][Openidconnect::CONFIG_ACCESS_TOKEN_ENDPOINTS] = 'groupdav';
		$this->assertTrue(Openidconnect::acceptsAccessTokensHere('/egroupware/groupdav.php', 'https'), 'opened by setup');
		$this->assertFalse(Openidconnect::acceptsAccessTokensHere('/egroupware/json.php', 'https'), 'still not json.php');

		// the defaults come from the request
		$_SERVER['SCRIPT_NAME'] = '/egroupware/webdav.php';
		$_SERVER['HTTPS'] = 'on';
		$this->assertTrue(Openidconnect::acceptsAccessTokensHere());
		unset($_SERVER['HTTPS']);
		$_SERVER['HTTP_X_FORWARDED_PROTO'] = 'https';
		$this->assertTrue(Openidconnect::acceptsAccessTokensHere(), 'https at the reverse proxy');
		unset($_SERVER['HTTP_X_FORWARDED_PROTO']);
		$this->assertFalse(Openidconnect::acceptsAccessTokensHere());

		// off altogether: nothing opens
		unset($GLOBALS['egw_info']['server'][Openidconnect::CONFIG_ACCESS_TOKENS]);
		$this->assertFalse(Openidconnect::acceptsAccessTokensHere('/egroupware/webdav.php', 'https'));
	}

	public function testGateAndOptIn()
	{
		$this->assertTrue(Openidconnect::looksLikeJWT('eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhc2lnIn0.c2lnbmF0dXJlLXNpZ25hdHVyZQ'));
		$this->assertFalse(Openidconnect::looksLikeJWT('secret'));
		$this->assertFalse(Openidconnect::looksLikeJWT('a.b.c'), 'too short to be a token');
		$this->assertFalse(Openidconnect::looksLikeJWT('token12_0123456789abcdef'), 'an EGroupware token is not a JWT');

		// off by default, and off without OpenID Connect as the authentication type
		unset($GLOBALS['egw_info']['server'][Openidconnect::CONFIG_ACCESS_TOKENS]);
		$this->assertFalse(Openidconnect::acceptsAccessTokens());
		$GLOBALS['egw_info']['server'][Openidconnect::CONFIG_ACCESS_TOKENS] = 'true';
		$GLOBALS['egw_info']['server']['oic_provider'] = self::ISSUER;
		$GLOBALS['egw_info']['server']['oic_client_id'] = self::CLIENT;
		$GLOBALS['egw_info']['server']['auth_type'] = 'sql';
		unset($GLOBALS['egw_info']['server']['auth_type_host'], $GLOBALS['egw_info']['server']['openidconnect_discovery']);
		$this->assertFalse(Openidconnect::acceptsAccessTokens(), 'a server not logging users in via the provider must not accept its tokens');
		$GLOBALS['egw_info']['server']['auth_type'] = 'openidconnect';
		$this->assertTrue(Openidconnect::acceptsAccessTokens());
		// the OpenID option on the login page (its label set) is the same trust
		$GLOBALS['egw_info']['server']['auth_type'] = 'sql';
		$GLOBALS['egw_info']['server']['openidconnect_discovery'] = 'EGroupware';
		$this->assertTrue(Openidconnect::acceptsAccessTokens());
	}
}
