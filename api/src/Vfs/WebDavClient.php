<?php
/**
 * EGroupware API - the WebDAV client of the webdav(s):// mounts: an access token goes as Bearer token (PATCH CORE)
 *
 * @link https://www.egroupware.org
 * @author Alexandros Sigalas
 * @package api
 * @subpackage vfs
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 */

namespace EGroupware\Api\Vfs;

use EGroupware\Api\Auth\Openidconnect;

/**
 * The vendor client with one change: a JWT in the url's userinfo leaves as "Authorization: Bearer"
 *
 * A $token mount resolves to webdavs://user:<jwt>@host/... (Base::accessTokenFor()); curl would
 * turn that into basic auth with the token as password. The token names the user, so it goes as
 * the Bearer token it is, and the url's userinfo is dropped with it. An ordinary user:password
 * stays in the url as before.
 */
class WebDavClient extends \Grale\WebDav\WebDavClient
{
	/**
	 * Every request of the parent is built here, streaming downloads included
	 *
	 * @param string $method
	 * @param string $uri
	 * @param ?array $headers
	 * @param mixed $body
	 * @return \GuzzleHttp\Psr7\Request
	 */
	protected function createRequest($method, $uri, array $headers = null, $body = null)
	{
		$request = parent::createRequest($method, $uri, $headers, $body);
		$userinfo = $request->getUri()->getUserInfo();
		$token = str_contains($userinfo, ':') ? explode(':', $userinfo, 2)[1] : $userinfo;
		if ($token !== '' && Openidconnect::looksLikeJWT($token))
		{
			$request = $request->withUri($request->getUri()->withUserInfo(''))
				->withHeader('Authorization', 'Bearer '.$token);
		}
		return $request;
	}
}
