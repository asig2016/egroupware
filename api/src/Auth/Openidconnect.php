<?php
/**
 * EGroupware Api: OpenIDConnect authentication (EGroupware against another OIC IdP)
 *
 * @link https://www.egroupware.org
 * @package api
 * @subpackage mail
 * @author Ralf Becker <rb@egroupware.org>
 * @copyright (c) 2023 by Ralf Becker <rb@egroupware.org>
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 */

namespace EGroupware\Api\Auth;

use EGroupware\Api;
use Jumbojett\OpenIDConnectClient;
use Jumbojett\OpenIDConnectClientException;

class Openidconnect implements BackendSSO
{
	protected OpenIDConnectClient $client;

	/**
	 * The client that verifies access tokens of the provider, built on first use
	 *
	 * @var ?AccessTokenClient
	 */
	protected ?AccessTokenClient $verification_client = null;

	/**
	 * Constructor
	 */
	public function __construct()
	{

		$this->client = $this->checkSetCommon($GLOBALS['egw_info']['server']['oic_provider']) ?:
			new OpenIDConnectClient($GLOBALS['egw_info']['server']['oic_provider'],
				$GLOBALS['egw_info']['server']['oic_client_id'],
				$GLOBALS['egw_info']['server']['oic_client_secret']);

		// add scopes we are processing ('openid' is added automatic)
		$this->client->addScope(['email', 'profile']);
	}

	/**
	 * Check for common providers like Microsoft and Google
	 *
	 * If that's the case we use our Api\Auth\OpenIDConnectClient instead of Jumbojett\OpenIDConnectClient direct.
	 * That way we automatically get all the quirks of these providers handled, including our client-id, -secret
	 * and the redirect via https://proxy.egroupware.org/oauth back to the instance.
	 *
	 * @param string $_provider
	 * @return OpenIDConnectClient|null
	 */
	protected function checkSetCommon(string $_provider) : ?OpenIDConnectClient
	{
		$host = parse_url($_provider, PHP_URL_HOST);

		foreach(Api\Auth\OpenIDConnectClient::$oauth_domain_regexps as [$imap, $smtp, $provider, $client, $secret, $scopes, $extra, $server_regexp])
		{
			if (stripos($provider, $host) !== false)
			{
				return Api\Auth\OpenIDConnectClient::byDomain($provider, $imap); // use the providers IMAP to match
			}
		}
		return null;
	}

	/**
	 * Attempt SSO login
	 *
	 * @return string sessionid on successful login, null otherwise
	 */
	function login()
	{
		try {
			//error_log(__METHOD__."() session_status()=".session_status().", _SESSION=".json_encode($_SESSION));
			$this->client->authenticate();

			// the configured claim, regular expression and verified-email rule - shared with the
			// access-token login of WebDAV & Co. (accountFromClaims()), so both name the same account
			if (($account_lid = self::usernameFromClaims(fn($claim) => $this->client->getVerifiedClaims($claim))) === null)
			{
				return null;
			}
			$attribute = self::usernameAttribute();
			$accounts = Api\Accounts::getInstance();
			if (!$accounts->name2id($account_lid, 'account_lid', 'u'))
			{
				// for attribute="email" check, if we have user with given email
				if ($attribute === 'email' && ($account_id = $accounts->name2id($account_lid, 'account_email', 'u')))
				{
					$account_lid = Api\Accounts::id2name($account_id);
				}
				else
				{
					// fail if auto-creation of authenticated users is NOT configured
					if (empty($GLOBALS['egw_info']['server']['auto_create_acct']))
					{
						Api\Auth::log(__METHOD__."() OpenIDConnect login successful, but user '$account_lid' does NOT exist in EGroupware, AND automatic user creating is disabled!");
						$_GET['cd'] = lang("OpenIDConnect login successful, but user '%1' does NOT exist in EGroupware, AND automatic user creating is disabled!", $account_lid);
						return null;
					}
					try {
						$user_info = $this->client->requestUserInfo();
						$GLOBALS['auto_create_acct'] = [
							'firstname' => $user_info->given_name,
							'lastname' => $user_info->family_name,
							'email' => $user_info->email,
							// not (yet) used supported keys
							//'primary_group' => '',
							//'add_group' => '',
							//'account_id' => 0,
						];
					}
					catch (OpenIDConnectClientException $e) {
						// do NOT fail, if IdP does not support user-info
						_egw_log_exception($e);
					}
				}
			}
			// return user session
			return $GLOBALS['egw']->session->create($account_lid, null, null, false, false);
		}
		catch(\Exception $e) {
			_egw_log_exception($e);
			$_GET['cd'] = 'OpenIDConnect Error: '.$e->getMessage();
			Api\Auth::log(__METHOD__."() OpenIDConnect Error: ".$e->getMessage());
			return null;
		}
	}

	/**
	 * The claim the username is taken from: setup's "Name of JWT payload attribute for username"
	 */
	public static function usernameAttribute(): string
	{
		$attribute = ($GLOBALS['egw_info']['server']['oic_username_attribute'] ?? 'sub');
		if ($attribute === 'custom' && !empty($GLOBALS['egw_info']['server']['oic_username_custom']))
		{
			$attribute = $GLOBALS['egw_info']['server']['oic_username_custom'];
		}
		return $attribute;
	}

	/**
	 * The username the provider's claims name, by setup's rules
	 *
	 * The configured attribute, the "verified email" rule and the regular expression - the one
	 * mapping the web login and the access-token login (accountFromClaims()) share, so a token
	 * can never name another account than the browser login would.
	 *
	 * @param callable $claim function(string $name): mixed - the claim's value, null if absent
	 * @return ?string username ('' when the claim is empty), null when an unverified email is
	 *	not allowed to log in
	 */
	public static function usernameFromClaims(callable $claim): ?string
	{
		$attribute = self::usernameAttribute();
		$account_lid = (string)$claim($attribute);

		// check for email attribute, that email is either verified or unverified emails are explicitly allowed
		if ($attribute === 'email' && !$claim('email_verified') && empty($GLOBALS['egw_info']['server']['oic_email_unverified']))
		{
			return null;
		}
		// extract username with regular expression, if configured and matching
		if (!empty($GLOBALS['egw_info']['server']['oic_username_preg']) && preg_match($GLOBALS['egw_info']['server']['oic_username_preg'], $account_lid))
		{
			$account_lid = preg_replace($GLOBALS['egw_info']['server']['oic_username_preg'], '$1', $account_lid);
		}
		return $account_lid;
	}

	/* -------------------------------------------- access tokens of the provider as Bearer token */

	/**
	 * Longest age (seconds since "iat") an access token is accepted with - the provider's TTL is
	 * the client's business, this is the ceiling: a token can not be revoked here, only outlive
	 */
	const MAX_TOKEN_AGE = 900;   // Vfs\Base::TOKEN_LIFETIME mints for 15 minutes
	/** how long a verified token's claims are kept (seconds), so a WebDAV client's burst of
	 * requests does not fetch the provider's keys every time; never beyond the token's expiry */
	const TOKEN_CACHE_TIME = 300;

	/**
	 * How long a token whose signature failed is refused without verifying it again, in seconds
	 */
	const REJECT_CACHE_TIME = 60;

	/**
	 * Setup: the endpoints accepting a token besides webdav.php: '' or 'groupdav'
	 */
	const CONFIG_ACCESS_TOKEN_ENDPOINTS = 'oic_access_token_endpoints';

	/**
	 * The signature algorithms accepted: asymmetric ones only
	 *
	 * The vendor client would also take an HMAC under the client secret, which every holder of
	 * that secret could forge.
	 */
	const ALGORITHMS = ['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512'];
	/** setup option: accept the provider's access tokens as Bearer token (WebDAV, and CalDAV/REST when opened) */
	const CONFIG_ACCESS_TOKENS = 'oic_access_tokens';

	/**
	 * Does this installation accept the provider's access tokens as Bearer token?
	 *
	 * Off unless setup says so AND the provider logs users into this installation already: as
	 * the authentication type, or as the OpenID Connect option on the login page (the label in
	 * setup, openidconnect_discovery). A server that does not trust the provider for the browser
	 * login must not trust it for WebDAV either.
	 */
	public static function acceptsAccessTokens(): bool
	{
		$server = $GLOBALS['egw_info']['server'] ?? [];
		return !empty($server[self::CONFIG_ACCESS_TOKENS]) && !empty($server['oic_provider']) && !empty($server['oic_client_id']) &&
			(($server['auth_type'] ?? '') === 'openidconnect' || ($server['auth_type_host'] ?? '') === 'openidconnect' ||
				!empty($server['openidconnect_discovery']));
	}

	/**
	 * Is a token accepted HERE: by this script, over this transport?
	 *
	 * The Authorization header reaches more than WebDAV (groupdav.php, json.php, changepwd.php,
	 * ...). A token opens webdav.php, groupdav.php (CalDAV, CardDAV and the REST API) when setup
	 * says so, nothing else - and never over plain HTTP, where it would be a credential in the
	 * clear.
	 *
	 * @param ?string $script =null the script, default $_SERVER['SCRIPT_NAME']
	 * @param ?string $scheme =null 'https' or 'http', default Api\Header\Http::schema()
	 * @param ?string &$why =null on false: the reason
	 * @return bool
	 */
	public static function acceptsAccessTokensHere(?string $script=null, ?string $scheme=null, ?string &$why=null): bool
	{
		$why = null;
		if (!self::acceptsAccessTokens())
		{
			$why = 'access tokens of the provider are not enabled';
			return false;
		}
		if (($scheme ?? Api\Header\Http::schema()) !== 'https')
		{
			$why = 'not over https';
			return false;
		}
		$script = basename($script ?? ($_SERVER['SCRIPT_NAME'] ?? ''));
		$endpoints = (string)($GLOBALS['egw_info']['server'][self::CONFIG_ACCESS_TOKEN_ENDPOINTS] ?? '');
		if ($script === 'webdav.php' || $script === 'groupdav.php' && str_contains($endpoints, 'groupdav'))
		{
			return true;
		}
		$why = "not accepted by ".($script ?: 'this script');
		return false;
	}

	/**
	 * The account a Bearer token logs in, if it is an access token of the provider
	 *
	 * The one call for Api\Header\Authenticate, after its own openid app did not recognise the
	 * token: null when tokens are not accepted at all or this is no JWT; a JWT at a closed door
	 * (script, transport) is logged. The token names the user ("sub"), nothing else is needed.
	 *
	 * @param string $jwt the Bearer token
	 * @param ?array &$limits =null on return the session limits of an accepted token
	 * @return ?string account_lid, null if this is no accepted token
	 */
	public static function accountFromBearer(string $jwt, ?array &$limits=null): ?string
	{
		if (!self::acceptsAccessTokens() || !self::looksLikeJWT($jwt))
		{
			return null;
		}
		if (!self::acceptsAccessTokensHere(null, null, $why))
		{
			Api\Auth::log(__METHOD__."() access token refused: $why");
			return null;
		}
		return (new self())->accountFromAccessToken($jwt, $limits);
	}

	/**
	 * Does a password look like a JWT (three base64url parts)? Only then a token login is tried
	 */
	public static function looksLikeJWT(string $password): bool
	{
		return (bool)preg_match('/^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/', $password);
	}

	/**
	 * The account an access token of the provider logs in, with the session limits it carries
	 *
	 * The signature is checked against the provider's published keys (its JWKS, through the
	 * client's discovery), then accountFromClaims() judges the claims. A verified token's claims
	 * are cached for TOKEN_CACHE_TIME, never beyond its expiry. A token whose signature failed,
	 * or could not be checked, is refused for REJECT_CACHE_TIME without asking the provider
	 * again; the provider's documents themselves are cached by AccessTokenClient.
	 *
	 * @param string $jwt
	 * @param ?array &$limits on return the session limits: app-name => true, always with 'api'
	 * @return ?string account_lid, null if the token is not accepted (reason in auth.log)
	 */
	public function accountFromAccessToken(string $jwt, ?array &$limits=null): ?string
	{
		$cache_key = 'access-token:'.sha1($jwt);
		$claims = Api\Cache::getInstance(__CLASS__, $cache_key);
		$fresh = !is_array($claims);
		if ($fresh)
		{
			if (self::rejectedRecently($jwt))
			{
				Api\Auth::log(__METHOD__."() access token refused again, its signature failed within the last ".self::REJECT_CACHE_TIME."s");
				return null;
			}
			$alg = (string)(self::headerOf($jwt)['alg'] ?? '');
			if (!in_array($alg, self::ALGORITHMS, true))
			{
				Api\Auth::log(__METHOD__."() access token rejected: signature algorithm '$alg' not accepted");
				self::rememberRejected($jwt);
				return null;
			}
			try {
				if (!$this->verificationClient()->verifyJWTsignature($jwt))
				{
					Api\Auth::log(__METHOD__."() access token signature NOT verified");
					self::rememberRejected($jwt);
					return null;
				}
				$claims = self::claimsOf($jwt);
			}
			catch (\Throwable $e) {
				Api\Auth::log(__METHOD__."() access token rejected: ".$e->getMessage());
				self::rememberRejected($jwt);
				return null;
			}
			$ttl = min(self::TOKEN_CACHE_TIME, max(1, (int)($claims['exp'] ?? 0) - time()));
			Api\Cache::setInstance(__CLASS__, $cache_key, $claims, $ttl);
		}
		$account = self::accountFromClaims($claims, (string)$GLOBALS['egw_info']['server']['oic_client_id'],
			(string)$GLOBALS['egw_info']['server']['oic_provider'], $limits);
		if ($account !== null && $fresh)
		{
			Api\Auth::log(__METHOD__."() access token of '$account' accepted for ".implode(',', array_keys($limits ?? [])).
				" from ".($_SERVER['REMOTE_ADDR'] ?? 'cli'));
		}
		return $account;
	}

	/**
	 * Judge the claims of an already signature-verified access token
	 *
	 * Every rule is a hard one:
	 * - not expired ("exp"), not before its time ("nbf"), and not older than MAX_TOKEN_AGE
	 *   since "iat" - a token can not be revoked here, so it must not live long
	 * - issued for THIS installation: "aud" contains our client id, and "iss", when the provider
	 *   sets one, is the configured provider (scheme and host)
	 * - limited to apps: the "scopes" must contain at least one "app-<name>" scope, and those
	 *   apps are the session's limits - a token that would open the whole API is refused
	 * - names an existing user account by setup's username rules (usernameFromClaims()), the
	 *   same rules the browser login applies; no account is created here
	 *
	 * @param array $claims the token's payload
	 * @param string $client_id this installation's client id at the provider
	 * @param ?string $issuer the configured provider url
	 * @param ?array &$limits on return app-name => true, plus 'api'
	 * @param ?int $now for tests
	 * @return ?string account_lid or null
	 */
	public static function accountFromClaims(array $claims, string $client_id, ?string $issuer, ?array &$limits=null, ?int $now=null): ?string
	{
		$now = $now ?? time();
		$limits = null;
		$reject = function(string $why) use ($claims)
		{
			Api\Auth::log(__METHOD__."() token for '".($claims['sub'] ?? '')."' rejected: $why");
			return null;
		};
		if (empty($claims['exp']) || (int)$claims['exp'] <= $now)
		{
			return $reject('expired');
		}
		if (!empty($claims['nbf']) && (int)$claims['nbf'] > $now + 60)
		{
			return $reject('not yet valid');
		}
		if (empty($claims['iat']) || (int)$claims['iat'] + self::MAX_TOKEN_AGE < $now || (int)$claims['iat'] > $now + 60)
		{
			return $reject('older than '.self::MAX_TOKEN_AGE.'s, or issued in the future');
		}
		$aud = (array)($claims['aud'] ?? []);
		if ($client_id === '' || !in_array($client_id, $aud, true))
		{
			return $reject('not issued for this client');
		}
		if (!empty($claims['iss']) && !empty($issuer) && !self::sameIssuer((string)$claims['iss'], $issuer))
		{
			return $reject('issued by '.$claims['iss'].', not by the configured provider');
		}
		$apps = [];
		foreach ((array)($claims['scopes'] ?? $claims['scope'] ?? []) as $scope)
		{
			foreach (preg_split('/\s+/', (string)$scope, -1, PREG_SPLIT_NO_EMPTY) as $s)
			{
				if (str_starts_with($s, 'app-') && preg_match('/^[a-z0-9_-]+$/i', substr($s, 4)))
				{
					$apps[substr($s, 4)] = true;
				}
			}
		}
		if (!$apps)
		{
			return $reject('no app-* scope, a token without app limits is not accepted');
		}
		$account_lid = self::usernameFromClaims(fn($name) => $claims[$name] ?? null);
		if ($account_lid === null || $account_lid === '')
		{
			return $reject('no usable username claim');
		}
		$accounts = Api\Accounts::getInstance();
		if (!($account_id = $accounts->name2id($account_lid, 'account_lid', 'u')))
		{
			return $reject("user '$account_lid' does not exist");
		}
		$account_lid = Api\Accounts::id2name($account_id);
		$limits = ['api' => true] + $apps;
		return $account_lid;
	}

	/**
	 * The client verifying access tokens: the vendor's, with the provider's documents cached
	 *
	 * @return AccessTokenClient
	 */
	protected function verificationClient(): AccessTokenClient
	{
		return $this->verification_client ??= new AccessTokenClient($GLOBALS['egw_info']['server']['oic_provider'],
			$GLOBALS['egw_info']['server']['oic_client_id'], $GLOBALS['egw_info']['server']['oic_client_secret'] ?? null);
	}

	/**
	 * Did this token's signature fail within REJECT_CACHE_TIME?
	 *
	 * @param string $jwt
	 * @return bool
	 */
	public static function rejectedRecently(string $jwt): bool
	{
		return (bool)Api\Cache::getInstance(__CLASS__, 'access-token-rejected:'.sha1($jwt));
	}

	/**
	 * Remember a token whose signature failed or could not be checked
	 *
	 * @param string $jwt
	 */
	protected static function rememberRejected(string $jwt): void
	{
		Api\Cache::setInstance(__CLASS__, 'access-token-rejected:'.sha1($jwt), time(), self::REJECT_CACHE_TIME);
	}

	/**
	 * The claims of a JWT, decoded and nothing else: only for a token whose signature verified
	 *
	 * The client is the vendor's class for any provider but the known mail providers, so this
	 * is not a method of our subclass.
	 *
	 * @param string $jwt
	 * @return array empty if not three parts or no JSON object
	 */
	public static function claimsOf(string $jwt): array
	{
		return self::partOf($jwt, 1);
	}

	/**
	 * The header of a JWT, decoded and nothing else
	 *
	 * @param string $jwt
	 * @return array empty if not three parts or no JSON object
	 */
	public static function headerOf(string $jwt): array
	{
		return self::partOf($jwt, 0);
	}

	private static function partOf(string $jwt, int $part): array
	{
		$parts = explode('.', $jwt);
		if (count($parts) !== 3)
		{
			return [];
		}
		$decoded = json_decode(base64_decode(strtr($parts[$part], '-_', '+/')), true);
		return is_array($decoded) ? $decoded : [];
	}

	/**
	 * Same provider? "iss" is compared on scheme and host, the configured url may carry a path
	 */
	protected static function sameIssuer(string $iss, string $configured): bool
	{
		$a = parse_url($iss);
		$b = parse_url($configured);
		return !empty($a['host']) && !empty($b['host']) && strcasecmp($a['host'], $b['host']) === 0 &&
			strcasecmp($a['scheme'] ?? 'https', $b['scheme'] ?? 'https') === 0;
	}

	/**
	 * Display a IdP selection / discovery
	 *
	 * Will be displayed if IdP(s) are added in setup and a discovery label is specified.
	 *
	 * @return string|null html to display in login page or null to disable the selection
	 */
	static public function discovery()
	{
		if (empty($GLOBALS['egw_info']['server']['openidconnect_discovery']))
		{
			return null;
		}
		return Api\Html::input('auth=openidconnect', $GLOBALS['egw_info']['server']['openidconnect_discovery'], 'submit', 'formmethod="get"');
	}

	/**
	 * Logout SSO system
	 */
	function logout()
	{
		$this->client->signOut($this->client->getIdToken(), null);
	}

	/**
	 * Return (which) parts of session needed by current auth backend
	 *
	 * If this returns any key(s), the session is NOT destroyed by Api\Session::destroy,
	 * just everything but the keys is removed.
	 *
	 * @return array of needed keys in session
	 */
	function needSession()
	{
		return ['openid_connect_state', 'openid_connect_nonce', 'openid_connect_code_verifier',
			Api\Session::EGW_APPSESSION_VAR];	// Auth stores backend via Cache::setSession()
	}

	/**
	 * password authentication against password stored in sql datababse
	 *
	 * @param string $username username of account to authenticate
	 * @param string $passwd corresponding password
	 * @param string $passwd_type ='text' 'text' for cleartext passwords (default)
	 * @return boolean true if successful authenticated, false otherwise
	 */
	function authenticate($username, $passwd, $passwd_type='text')
	{
		// add username and password
		$this->client->addAuthParam([
			'username' => $username,
			'password' => $passwd,
		]);
		// perform the auth and return the token (to validate check if the access_token property is there and a valid JWT) :
		try {
			$repsonse = $this->client->requestResourceOwnerToken(TRUE);
			if (empty($repsonse->access_token))
			{
				Api\Auth::log(__METHOD__."('$username', ...) OpenIDConnect Response: ".json_encode($repsonse)." returning FALSE");
				return false;
			}
			Api\Auth::log(__METHOD__."('$username', ...) returning TRUE");
			return true;
		}
		catch(OpenIDConnectClientException $e) {
			// ignore
			_egw_log_exception($e);
			Api\Auth::log(__METHOD__."('$username', ...) OpenIDConnect Error: ".$e->getMessage());
		}
		return false;
	}

	/**
	 * changes password in sql datababse
	 *
	 * @param string $old_passwd must be cleartext
	 * @param string $new_passwd must be cleartext
	 * @param int $account_id account id of user whose passwd should be changed
	 * @throws Exception to give a verbose error, why changing password failed
	 * @return boolean true if password successful changed, false otherwise
	 */
	function change_password($old_passwd, $new_passwd, $account_id=0)
	{
		return false;
	}
}