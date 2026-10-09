<?php
/**
 * Test EGroupware\Api\Mail\Jmap\Imap::emailFromFetch() with an address of an empty domain ("user@")
 *
 * addressListFromHeader() read the From/To/Cc/Bcc/Reply-To headers through Horde_Mime_Headers::toArray(),
 * which send-encodes EVERY header of the message: an address with an empty domain anywhere made
 * idn_to_ascii() throw a ValueError, the whole Email/get failed, and the message list of the folder
 * stayed empty for the user (seen live 2026-10-09). A stub socket and a plain
 * Horde_Imap_Client_Data_Fetch fixture, as in JmapShimReplyThreadHeadersTest - no DB/IMAP/session.
 *
 * @link http://www.egroupware.org
 * @package mail
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 */

namespace EGroupware\Mail;

use EGroupware\Api\Mail\Jmap\Imap as JmapShim;

class JmapAddressHeaderEmptyDomainTest extends \PHPUnit\Framework\TestCase
{
	private function emailFromFetch(string $address_headers) : array
	{
		$imap = $this->createStub(\Horde_Imap_Client_Socket::class);
		$data = new \Horde_Imap_Client_Data_Fetch();
		$data->setHeaders('addresses', $address_headers."\r\n");
		return JmapShim::emailFromFetch($imap, 'INBOX', '42', $data, false);
	}

	public function testAnEmptyDomainInOneHeaderDoesNotFailTheMessage()
	{
		$email = $this->emailFromFetch(
			"From: Alice <alice@example.com>\r\n".
			"To: bob@example.com\r\n".
			"Reply-To: broken@\r\n");

		$this->assertEquals([['email' => 'alice@example.com', 'name' => 'Alice']], $email['from']);
		$this->assertSame([['email' => 'bob@example.com']], $email['to']);
	}

	public function testAnEmptyDomainInTheAddressItselfDoesNotFailTheMessage()
	{
		$email = $this->emailFromFetch(
			"From: Alice <alice@example.com>\r\n".
			"To: Undisclosed <nobody@>\r\n");

		$this->assertSame('alice@example.com', $email['from'][0]['email']);
		$this->assertIsArray($email['to']);
	}
}
