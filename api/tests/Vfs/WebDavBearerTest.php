<?php
/**
 * EGroupware API - the WebDAV client of a $token mount sends the token as Bearer token (PATCH CORE)
 *
 * CONTRACT UNDER TEST
 * Api\Vfs\WebDavClient, the client of the webdav(s):// mounts: a JWT in the url's userinfo, what
 * a $token mount resolves to, leaves as "Authorization: Bearer" with the userinfo dropped; an
 * ordinary user:password stays in the url, where curl makes basic auth of it as before.
 *
 * SETUP STRATEGY
 * Guzzle's mock handler in place of the network; the request that reaches it is inspected.
 *
 * PASS CRITERIA
 * The Authorization header and the userinfo of the request the handler receives.
 *
 * @package api
 * @subpackage tests
 */

namespace EGroupware\Api\Vfs;

use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;

class WebDavBearerTest extends TestCase
{
	const JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJzb21lb25lIiwiYXVkIjoiZmlsZXMifQ.c2lnbmF0dXJlLXNpZ25hdHVyZS1zaWduYXR1cmU';

	private function clientWith(MockHandler $mock): WebDavClient
	{
		$client = new WebDavClient();
		$client->setHttpClient(new Client(['handler' => HandlerStack::create($mock)]));
		return $client;
	}

	public function testTokenLeavesAsBearerWithoutTheUserinfo()
	{
		$mock = new MockHandler([new Response(200), new Response(200)]);
		$client = $this->clientWith($mock);
		$this->assertTrue($client->exists('https://someone:'.self::JWT.'@files.example.invalid/egroupware/webdav.php/home'));
		$request = $mock->getLastRequest();
		$this->assertSame('Bearer '.self::JWT, $request->getHeaderLine('Authorization'));
		$this->assertSame('', $request->getUri()->getUserInfo(), 'the token names the user, the url does not');
		$this->assertSame('https://files.example.invalid/egroupware/webdav.php/home', (string)$request->getUri());

		// $token alone in the userinfo, without a user part
		$client->exists('https://'.self::JWT.'@files.example.invalid/dav');
		$this->assertSame('Bearer '.self::JWT, $mock->getLastRequest()->getHeaderLine('Authorization'));
	}

	public function testPasswordStaysInTheUrl()
	{
		$mock = new MockHandler([new Response(200)]);
		$client = $this->clientWith($mock);
		$client->exists('https://someone:secret@files.example.invalid/dav');
		$request = $mock->getLastRequest();
		$this->assertSame('', $request->getHeaderLine('Authorization'));
		$this->assertSame('someone:secret', $request->getUri()->getUserInfo(), 'basic auth by curl, as before');
	}
}
