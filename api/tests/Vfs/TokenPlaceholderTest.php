<?php
/**
 * EGroupware API - $token in a mount url: an access token per user and request (PATCH CORE)
 *
 * CONTRACT UNDER TEST
 * Vfs\Base::resolve_url() replaces $token in a mounted url with an access token for the current
 * user and the client the mount names (?oidc_client=..., &oidc_scope=...), strips those two
 * parameters, mints once per session and client and reuses the token while it lives. Nothing
 * is minted for an unencrypted scheme, a mount that names no client, or a scope that is not an
 * app-* scope - the placeholder then resolves to '' and the other side answers 401.
 *
 * SETUP STRATEGY
 * A temporary (non-persistent) mount under a unique path, root rights for the duration,
 * and Vfs\Base::$access_token_provider replaced by a closure that records its calls and hands
 * back a JWT-shaped string with a far expiry - the real minting (the OpenID app) is not exercised.
 *
 * PASS CRITERIA
 * The resolved url per case, and how often the provider was asked.
 *
 * @package api
 * @subpackage tests
 */

namespace EGroupware\Api\Vfs;

require_once __DIR__ . '/../LoggedInTest.php';

use EGroupware\Api\LoggedInTest;
use EGroupware\Api\Vfs;

class TokenPlaceholderTest extends LoggedInTest
{
	private string $path;
	private $is_root_backup;
	private array $calls = [];
	private array $server_backup = [];
	private ?string $lid_backup = null;

	private function setServer(string $name, $value): void
	{
		if (!array_key_exists($name, $this->server_backup))
		{
			$this->server_backup[$name] = $GLOBALS['egw_info']['server'][$name] ?? null;
		}
		$GLOBALS['egw_info']['server'][$name] = $value;
	}

	/** the provider's token of the login, as Auth\Openidconnect::idpAccessToken() would give it */
	private function idpTokens(string $token='eyJhbGciOiJSUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.idp-signature'): void
	{
		Base::$idp_token_provider = function(&$why) use ($token)
		{
			$this->calls[] = ['idp'];
			return $token;
		};
	}

	protected function setUp(): void
	{
		parent::setUp();
		$this->path = '/token-mount-'.uniqid();
		$this->is_root_backup = Vfs::$is_root;
		Vfs::$is_root = true;
		$this->calls = [];
		Base::forgetAccessTokens();   // the session keeps minted tokens across tests
		Base::$access_token_provider = function(string $client, array $scopes)
		{
			$this->calls[] = [$client, $scopes];
			$payload = rtrim(strtr(base64_encode(json_encode(['exp' => time() + 3600])), '+/', '-_'), '=');
			return 'eyJhbGciOiJSUzI1NiJ9.'.$payload.'.signature-of-'.count($this->calls);
		};
	}

	protected function tearDown(): void
	{
		Base::$access_token_provider = null;
		Base::$idp_token_provider = null;
		foreach ($this->server_backup as $name => $value)
		{
			if ($value === null) unset($GLOBALS['egw_info']['server'][$name]);
			else $GLOBALS['egw_info']['server'][$name] = $value;
		}
		$this->server_backup = [];
		if (isset($this->lid_backup)) $GLOBALS['egw_info']['user']['account_lid'] = $this->lid_backup;
		@Vfs::umount($this->path);   // a temporary mount may already be gone, see mount()
		Vfs::$is_root = $this->is_root_backup;
		parent::tearDown();
	}

	/**
	 * A fresh path per mount: the resolver caches resolved urls by path for the request, and
	 * the stream wrapper's init_static() drops a temporary mount from the table again
	 */
	private function mount(string $url): void
	{
		$this->path = '/token-mount-'.uniqid();
		$this->assertTrue(Vfs::mount($url, $this->path, false, false), 'temporary mount');
		Vfs::clearstatcache();
	}

	private function resolve(string $relative): string
	{
		return Vfs::resolve_url($this->path.$relative, true, false);
	}

	public function testTokenIsMintedForTheClientAndTheParametersAreStripped()
	{
		$lid = $GLOBALS['egw_info']['user']['account_lid'];
		$this->mount('webdavs://$user:$token@dav.example.invalid/egroupware/webdav.php/home?oidc_client=dms&oidc_scope=app-filemanager,app-infolog');

		$url = $this->resolve('/sub/file.txt');
		$this->assertMatchesRegularExpression('#^webdavs://'.preg_quote($lid, '#').':eyJhbGciOiJSUzI1NiJ9\.[A-Za-z0-9_-]+\.signature-of-1@dav\.example\.invalid/egroupware/webdav\.php/home/sub/file\.txt$#', $url);
		$this->assertStringNotContainsString('oidc_', $url, 'the parameters are for us, not for the other side');
		$this->assertSame([['dms', ['app-filemanager', 'app-infolog']]], $this->calls);

		// reused while it lives: the second request does not mint again
		$this->resolve('/other.txt');
		$this->assertCount(1, $this->calls);
	}

	public function testDefaultScopeIsTheFilemanager()
	{
		$this->mount('webdavs://$user:$token@dav.example.invalid/dav?oidc_client=dms');
		$this->resolve('/x');
		$this->assertSame([['dms', ['app-filemanager']]], $this->calls);
	}

	/**
	 * A trailing slash after the query is a habit, not part of the scope; and the mounts page's
	 * status names the token or the reason
	 */
	public function testTrailingSlashAndStatus()
	{
		$this->mount('webdavs://$user:$token@dav.example.invalid/dav?oidc_client=dms&oidc_scope=app-filemanager/');
		$this->assertStringContainsString(':eyJhbGciOiJSUzI1NiJ9.', $this->resolve('/x'));
		$this->assertSame([['dms', ['app-filemanager']]], $this->calls);
		$this->assertMatchesRegularExpression('/^token minted, valid \d+ minutes$/',
			Base::accessTokenStatus('webdavs://$user:$token@dav.example.invalid/dav?oidc_client=dms'));
		$this->assertStringContainsString('not encrypted', Base::accessTokenStatus('webdav://$user:$token@dav.example.invalid/dav?oidc_client=dms'));
		$this->assertSame('', Base::accessTokenStatus('webdavs://$user:$pass@dav.example.invalid/dav'));
	}

	/**
	 * A mount form that url-encodes the password field stores %24token: the same placeholder
	 */
	public function testUrlEncodedPlaceholderIsThePlaceholder()
	{
		$this->mount('webdavs://$user:%24token@dav.example.invalid/dav?oidc_client=dms');
		$url = $this->resolve('/x');
		$this->assertStringContainsString(':eyJhbGciOiJSUzI1NiJ9.', $url);
		$this->assertStringNotContainsString('%24token', $url);
		$this->assertCount(1, $this->calls);
	}

	public function testNoTokenWithoutEncryptionClientOrAppScope()
	{
		$lid = $GLOBALS['egw_info']['user']['account_lid'];
		$this->mount('webdav://$user:$token@dav.example.invalid/dav?oidc_client=dms');
		$this->assertSame("webdav://$lid:@dav.example.invalid/dav/x", $this->resolve('/x'), 'clear text: no token');
		$this->assertSame([], $this->calls);

		$this->mount('webdavs://$user:$token@dav.example.invalid/dav');
		$this->assertSame("webdavs://$lid:@dav.example.invalid/dav/x", $this->resolve('/x'), 'no client named: no token');
		$this->assertSame([], $this->calls);

		$this->mount('webdavs://$user:$token@dav.example.invalid/dav?oidc_client=dms&oidc_scope=openid');
		$this->assertSame("webdavs://$lid:@dav.example.invalid/dav/x", $this->resolve('/x'), 'not an app scope: no token');
		$this->assertSame([], $this->calls);
	}

	public function testOtherParametersOfTheMountSurvive()
	{
		$this->assertSame('webdavs://u:$token@h/p?keep=1', Base::withoutTokenParams('webdavs://u:$token@h/p?oidc_client=dms&keep=1&oidc_scope=app-x'));
		$this->assertSame('webdavs://u:$token@h/p', Base::withoutTokenParams('webdavs://u:$token@h/p?oidc_client=dms'));
		$this->assertSame('webdavs://u:p@h/p', Base::withoutTokenParams('webdavs://u:p@h/p'));
	}

	/* ---------------------------- ?oidc_source=idp: the provider's own token of the SSO login */

	public function testIdpTokenGoesToTheProvider()
	{
		$lid = $GLOBALS['egw_info']['user']['account_lid'];
		$this->setServer('oic_provider', 'https://idp.example.invalid');
		$this->idpTokens();
		$this->mount('webdavs://$user:$token@idp.example.invalid/egroupware/webdav.php/home/Team1?oidc_source=idp');

		$this->assertSame('webdavs://'.rawurlencode($lid).':eyJhbGciOiJSUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.idp-signature@idp.example.invalid/egroupware/webdav.php/home/Team1/x.txt',
			$this->resolve('/x.txt'));
		$this->assertSame([['idp']], $this->calls);
		$this->assertMatchesRegularExpression('/^token minted, valid \d+ minutes$/',
			Base::accessTokenStatus('webdavs://$user:$token@idp.example.invalid/dav?oidc_source=idp'));
	}

	/**
	 * The provider's token is the user's credential ON the provider: another host, port or
	 * scheme than the configured provider gets nothing - the provider is not even asked
	 */
	public function testIdpTokenNeverLeavesForAnotherHost()
	{
		$lid = rawurlencode($GLOBALS['egw_info']['user']['account_lid']);
		$this->setServer('oic_provider', 'https://idp.example.invalid');
		$this->idpTokens();

		foreach ([
			'webdavs://$user:$token@other.example.invalid/dav?oidc_source=idp' => "webdavs://$lid:@other.example.invalid/dav/x",
			'webdavs://$user:$token@idp.example.invalid:8443/dav?oidc_source=idp' => "webdavs://$lid:@idp.example.invalid:8443/dav/x",
			'webdavs://$user:$token@idp.example.invalid.evil.example/dav?oidc_source=idp' => "webdavs://$lid:@idp.example.invalid.evil.example/dav/x",
			'webdav://$user:$token@idp.example.invalid/dav?oidc_source=idp' => "webdav://$lid:@idp.example.invalid/dav/x",
		] as $mount => $expected)
		{
			$this->mount($mount);
			$this->assertSame($expected, $this->resolve('/x'), $mount);
		}
		$this->assertSame([], $this->calls, 'the provider\'s token was never asked for');
		$this->assertStringContainsString('not on the OpenID Connect provider',
			Base::accessTokenStatus('webdavs://$user:$token@other.example.invalid/dav?oidc_source=idp'));

		// a provider configured without https: no token at all
		$this->setServer('oic_provider', 'http://idp.example.invalid');
		$this->mount('webdavs://$user:$token@idp.example.invalid/dav?oidc_source=idp');
		$this->assertSame("webdavs://$lid:@idp.example.invalid/dav/x", $this->resolve('/x'));
		$this->assertSame([], $this->calls);
	}

	public function testNoIdpTokenIsAnEmptyPassword()
	{
		$lid = rawurlencode($GLOBALS['egw_info']['user']['account_lid']);
		$this->setServer('oic_provider', 'https://idp.example.invalid');
		Base::$idp_token_provider = function(&$why)
		{
			$why = 'no token of the OpenID Connect provider in this session (log in through the provider)';
			return '';
		};
		$this->mount('webdavs://$user:$token@idp.example.invalid/dav?oidc_source=idp');
		$this->assertSame("webdavs://$lid:@idp.example.invalid/dav/x", $this->resolve('/x'));
		$this->assertStringContainsString('log in through the provider',
			Base::accessTokenStatus('webdavs://$user:$token@idp.example.invalid/dav?oidc_source=idp'));
	}

	/* -------------------------------- the filled-in url keeps the token with the mount's host */

	/**
	 * An account name with "@", ":" or "/" must not move the host the token goes to: $user is
	 * encoded for a token mount
	 */
	public function testAccountNameCannotMoveTheHost()
	{
		$this->lid_backup = $GLOBALS['egw_info']['user']['account_lid'];
		$GLOBALS['egw_info']['user']['account_lid'] = 'x@evil.example.invalid:1/?';
		$this->mount('webdavs://$user:$token@dav.example.invalid/dav?oidc_client=dms');

		$url = $this->resolve('/x');
		$this->assertSame('dav.example.invalid', parse_url($url, PHP_URL_HOST));
		$this->assertStringStartsWith('webdavs://x%40evil.example.invalid%3A1%2F%3F:eyJhbGciOiJSUzI1NiJ9.', $url);
	}

	/**
	 * A fallback-auth parameter in the path names the user of a $pass mount when the session
	 * has no password (an SSO login) - never the user of a token mount
	 */
	public function testFallbackAuthDoesNotNameTheTokenUser()
	{
		$lid = rawurlencode($GLOBALS['egw_info']['user']['account_lid']);
		$this->setServer('oic_provider', 'https://idp.example.invalid');
		$this->idpTokens();
		$this->mount('webdavs://$user:$token@idp.example.invalid/dav?oidc_source=idp');

		$url = $this->resolve('/x?fallback-auth='.base64_encode('a@evil.example.invalid/:pw'));
		$this->assertSame('idp.example.invalid', parse_url($url, PHP_URL_HOST));
		$this->assertStringStartsWith("webdavs://$lid:eyJhbGciOiJSUzI1NiJ9.", $url);
	}

	/**
	 * A placeholder in the host part ($host is the EGroupware domain) fills in another host than
	 * the token was given for: the token is dropped
	 */
	public function testTokenIsDroppedWhenTheHostIsFilledIn()
	{
		$this->mount('webdavs://$user:$token@$host/dav?oidc_client=dms');
		$url = $this->resolve('/x');
		$this->assertStringNotContainsString('eyJhbGciOiJSUzI1NiJ9', $url);
		$this->assertStringContainsString(':@', $url);
	}

	public function testSourceParameterIsStripped()
	{
		$this->assertSame('webdavs://u:$token@h/p?keep=1', Base::withoutTokenParams('webdavs://u:$token@h/p?oidc_source=idp&keep=1'));
	}
}
