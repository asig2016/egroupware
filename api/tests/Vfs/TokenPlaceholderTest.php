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
}
