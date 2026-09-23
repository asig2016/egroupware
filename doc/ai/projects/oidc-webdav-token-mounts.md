# OpenID Connect access tokens for WebDAV mounts between EGroupware installations (PATCH CORE)

Two EGroupware installations, one the OpenID Connect provider of the other - in the examples
below `idp.example.org` (the provider) and `files.example.org` (the other side, registered at
the provider as client `files`): users of the provider open the browser login of the other side
without a password, through the `openid` app. Mounting the other side's WebDAV in the provider's
VFS had no equivalent: a mount url carries `$user:$pass`, and the other side cannot verify a
password over basic auth other than by forwarding it to the provider as an OAuth2 password grant
- which needs the grant allowed for the client, the same password on both sides, and the
password to be typed in the first place. Tokens are the
"same logic as the web login" for WebDAV.

## What it does

**On the provider (the mounting side)** - `Api\Vfs\Base::accessTokenFor()`, a `$token`
placeholder in the mount url next to `$user`, `$pass`, `$host`, `$home`:

```
webdavs://$user:$token@files.example.org/egroupware/webdav.php/home?oidc_client=files&oidc_scope=app-filemanager
```

`resolve_url()` mints, per request, an access token of the `openid` app for the current user and
the client `oidc_client`, with the app scopes `oidc_scope` (default `app-filemanager`), strips the
two parameters, and puts the JWT into the url's userinfo, which the client of the webdav(s)
mounts (`Api\Vfs\WebDavClient`) sends as "Authorization: Bearer" - the url's user part is not
needed, the token names the user. Minted once per session and client,
reused while it lives at least 5 minutes (`TOKEN_MIN_LIFETIME`); the token's `sub` is the account
name, as in the id token of the browser login, plus `preferred_username` and `email`.

**On the other side** - `Api\Header\Authenticate::autocreate_session_callback()`: a Bearer
token the local `openid` app did not issue is handed to `Auth\Openidconnect::accountFromBearer()`,
which checks the door (`acceptsAccessTokensHere()`: the script and https) and then
`accountFromAccessToken()`: signature against the provider's published keys
(the vendor client's `verifyJWTsignature()`, discovery of the configured `oic_provider`), then
`accountFromClaims()`. The session is created without a password check, with the token's app
scopes as `Session::$limits`. Opt-in: setup > "Access tokens of the IdP", and only
where OpenID Connect logs users in already: as the authentication type, or as the option on the
login page (`openidconnect_discovery`, the label).

**The mount page** (`filemanager_admin`) no longer probes a url with placeholders using the
admin's own credentials - `Vfs::mount()`'s default rule - and says "not verified" instead. Its
new "Clear mount cache" button invalidates the session copy of the mount table in every session,
drops this request's resolved urls (`Vfs::clearstatcache()`) and the tokens minted for `$token`
mounts (`Vfs\Base::forgetAccessTokens()`, one session key `oidc-tokens`).

## The hard rules, and why

| rule | where | why |
|---|---|---|
| `exp` in the future, `nbf` not in the future, `iat` present and at most `MAX_TOKEN_AGE` (15 min) old | `accountFromClaims()` | the other side cannot revoke a provider token; short life is the only revocation. The provider mints for 15 minutes (`Vfs\Base::TOKEN_LIFETIME`) and re-mints silently |
| only `webdav.php`; `groupdav.php` (CalDAV, CardDAV, REST API) when setup says so; never `json.php`, `changepwd.php`, `remote.php`, ... | `acceptsAccessTokensHere()` | the Authorization header reaches many scripts; a mount token needs one door. Setup: "Access tokens open" |
| only over https (also behind a reverse proxy, `Header\Http::schema()`) | same | a token in the clear is a credential in the clear; refused before it is even verified |
| RS256/384/512 and PS256/384/512 only, judged from the header before the vendor sees the token | `accountFromAccessToken()` | the vendor client also takes HMAC under the client secret: every holder of that secret could forge tokens |
| every fresh acceptance logged with account, apps and address | same | forensics: success was silent before |
| `aud` contains the other side's `oic_client_id` | same | a token the provider issued for any other client (a mail app, another instance) must not open it |
| `iss`, when the provider sets one, is the configured provider (scheme + host) | same | belt and braces over the signature |
| at least one `app-*` scope, and only those apps become the session's limits (+ `api`) | same | the handler serves REST and CalDAV too; a token minted for a file mount must not be a full-API credential |
| an existing user account, by setup's username rules (`usernameFromClaims()`, shared with `login()`) | same | a token can never name an account the browser login would not; nothing is auto-created over WebDAV |
| `webdavs://` or `https://` only | `accessTokenFor()` | a token in the clear is a credential in the clear |
| a user session - no async job, no setup | same | the token names the session's user, nobody else |
| the client exists and allows the scopes | `mintAccessToken()` | the mount cannot mint more than the client is registered for |
| the user has a refresh token for the client | same (`Token::accessToken(..., $require_refresh_token=true)`) | a browser login over there first: the `openid` app's own rule for tokens minted without a grant, an explicit prior authorization |
| off unless setup says so AND the provider logs users in (`auth_type` `openidconnect`, or the login-page option) | `acceptsAccessTokens()` | an installation that does not trust the provider for its browser login must not trust it for WebDAV |
| verified claims cached 5 minutes at most, never beyond `exp` | `accountFromAccessToken()` | a WebDAV client's burst does not verify per request |
| the provider's discovery document and keys cached 5 minutes | `AccessTokenClient::fetchURL()` | anyone who can reach `webdav.php` can send JWT-shaped Bearer tokens without an account; without the cache each attempt is two requests to the provider. A rotated-in key is seen within 5 minutes |
| a token whose signature failed, or could not be checked, is refused for 1 minute without verifying again | `accountFromAccessToken()` | a repeated bad token costs one cache lookup; a provider hiccup refuses a good token for a minute at most |

A second factor configured on the other side is bypassed, exactly as the browser login through the provider
bypasses it; the trust is the same.

## Files (all core, one `PATCH CORE` commit)

- `api/src/Auth/Openidconnect.php` - `usernameAttribute()`, `usernameFromClaims()` (factored out
  of `login()`), `acceptsAccessTokens()`, `looksLikeJWT()`, `accountFromAccessToken()`,
  `accountFromClaims()`, `sameIssuer()`; upstream conflict risk: `login()`.
- `api/src/Auth/AccessTokenClient.php` - the vendor client with its plain GETs cached
  (`$fetch` test seam).
- `api/src/Header/Authenticate.php` - one `elseif` after the openid app's own Bearer branch.
- `api/src/Vfs/WebDavClient.php` - the client of the webdav(s) mounts: a JWT in the userinfo
  leaves as Bearer token (registered by `Vfs\Base::load_wrapper()`).
- `api/src/Vfs/Base.php` - the `$token` placeholder, `accessTokenFor()`, `mintAccessToken()`,
  `withoutTokenParams()`, `$access_token_provider` (test seam); upstream conflict risk: `resolve_url()`.
- `filemanager/inc/class.filemanager_admin.inc.php` - no probe for placeholder urls.
- `setup/templates/default/config.tpl`, `setup/lang/egw_{en,de}.lang`, `filemanager/lang/egw_{en,de}.lang`.
- Tests: `api/tests/Auth/OpenidconnectAccessTokenTest.php` (every rule of `accountFromClaims()`,
  the gate, the opt-in), `api/tests/Vfs/TokenPlaceholderTest.php` (minting, reuse, stripping,
  the three refusals, with the provider seam), `api/tests/Vfs/WebDavBearerTest.php` (the Bearer
  header, with Guzzle's mock handler).

## Setting it up

1. On the provider: the other installation is a client of the `openid` app, with `app-filemanager`
   among its allowed scopes. The mount url as above, saved on the mounts page as superuser.
2. On the other side: setup > OpenID Connect > "Access tokens of the IdP" ticked;
   OpenID Connect as authentication type, or its option on the login page (the label).
   "Access tokens open": WebDAV only (default), or also CalDAV, CardDAV and the REST API - a
   token still opens only the apps of its scopes, so a CalDAV client needs a token minted with
   `app-calendar` or `app-addressbook`.
   The mounts page on the provider shows per `$token` mount whether a token is minted for the
   admin looking, or why not ("Token: ...").
3. Every user logs into the other side through the browser once (that is the refresh token the
   minting requires); from then on the mounted folder shows them their own files over there.

Not covered: a third installation that only logs in via the provider cannot mount the other side this way -
its login token has its own client id as audience, and the `openid` app has no token exchange.
The accepting path is tested end to end with a locally signed token and the vendor client
(`testSignedTokenIsVerifiedAgainstTheProvidersKeys`); the first cut called a method of our
`OpenIDConnectClient` subclass, which the constructor builds only for the known mail providers,
so every token of an EGroupware provider verified and then died - the claims are decoded by
`Openidconnect::claimsOf()` now.
