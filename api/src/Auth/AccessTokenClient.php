<?php
/**
 * EGroupware API - the OpenID Connect client that verifies access tokens of the provider (PATCH CORE)
 *
 * @link https://www.egroupware.org
 * @author Alexandros Sigalas
 * @package api
 * @subpackage auth
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 */

namespace EGroupware\Api\Auth;

use EGroupware\Api;

/**
 * The vendor client with its plain GET requests cached in the instance cache
 *
 * Auth\Openidconnect::accountFromAccessToken() verifies a token's signature through the vendor's
 * verifyJWTsignature(), which fetches the provider's discovery document and its keys per call.
 * Anyone who can reach webdav.php can send JWT-shaped Bearer tokens without an account; without
 * this cache each attempt is two requests to the provider. A key the provider rotates in is
 * seen after FETCH_CACHE_TIME at most. Requests with a body or headers (token, userinfo) are
 * not cached.
 */
class AccessTokenClient extends \Jumbojett\OpenIDConnectClient
{
	/**
	 * How long the discovery document and the keys are kept, in seconds
	 */
	const FETCH_CACHE_TIME = 300;

	/**
	 * Test seam: function(string $url): string in place of the HTTP request
	 *
	 * @var ?\Closure
	 */
	public static ?\Closure $fetch = null;

	/**
	 * The cache location of a url's document
	 *
	 * @param string $url
	 * @return string
	 */
	public static function cacheKey(string $url): string
	{
		return 'fetch:'.sha1($url);
	}

	/**
	 * A plain GET is a document of the provider: from the cache while it is fresh
	 *
	 * @param string $url
	 * @param ?string $post_body
	 * @param array $headers
	 * @return string|false
	 */
	protected function fetchURL($url, $post_body = null, $headers = [])
	{
		if ($post_body !== null || $headers)
		{
			return parent::fetchURL($url, $post_body, $headers);
		}
		$body = Api\Cache::getInstance(__CLASS__, self::cacheKey($url));
		if (!is_string($body))
		{
			$body = self::$fetch ? (self::$fetch)($url) : parent::fetchURL($url);
			if (is_string($body) && $body !== '')
			{
				Api\Cache::setInstance(__CLASS__, self::cacheKey($url), $body, self::FETCH_CACHE_TIME);
			}
		}
		return $body;
	}
}
