<?php
/**
 * EGroupware Api: Support for Sieve scripts
 *
 * @link https://www.egroupware.org
 * @package api
 * @subpackage mail
 * @author Ralf Becker <rb@egroupware.org>
 * @author Klaus Leithoff
 * @author Lars Kneschke
 * @license https://opensource.org/license/gpl-2-0 GPL 2.0+ - GNU General Public License 2.0 or any higher version of your choice
 */

namespace EGroupware\Api\Mail\Sieve;

use EGroupware\Api\Translation;
use Horde;

/**
 * Support for Sieve scripts: general Logic using Connection (e.g. Sieve\Jmap or Horde\ManageSieve) and the Script class
 *
 * Constructor and setters will throw exceptions for connection, login or other errors.
 *
 * retrieveRules and getters will not throw an exception if there's no script currently.
 *
 * Most methods incl. constructor accepts a script-name, but by default the current active script is used
 * and if there's no script Sieve::DEFAULT_SCRIPT_NAME.
 */
trait Logic
{
	/**
	 * Default script name used if no active script found on server
	 */
	const DEFAULT_SCRIPT_NAME = 'mail';

	/**
	 * reference to Imap object
	 *
	 * @var Imap
	 */
	var $icServer;

	/**
	* @var string name of active script queried from Sieve server
	*/
	var $scriptName;

	/**
	 * @var string full Sieve script as text
	 */
	var $script;

	/**
	* @var array $rules containing the rules
	*/
	var $rules;

	/**
	* @var array $vacation containing the vacation
	*/
	var $vacation;

	/**
	* @var array $emailNotification containing the emailNotification
	*/
	var $emailNotification;

	/**
	* @var object $error the last PEAR error object
	*/
	var $error;

	/**
	 * The timeout for the connection to the SIEVE server.
	 * @var int
	 */
	var $_timeout = 10;

	/**
	 * Switch on some error_log debug messages
	 *
	 * @var boolean
	 */
	var $debug = false;

	function getRules()
	{
		if (!isset($this->rules)) $this->retrieveRules();

		return $this->rules;
	}

	function getVacation()
	{
		if (!isset($this->rules)) $this->retrieveRules();

		return $this->vacation;
	}

	function getEmailNotification()
	{
		if (!isset($this->rules)) $this->retrieveRules();

		return $this->emailNotification;
	}

	/**
	 * Set email notifications
	 *
	 * @param array $_rules
	 * @param string $_scriptName
	 * @param boolean $utf7imap_fileinto =false true: encode foldernames with utf7imap, default utf8
	 */
	function setRules(array $_rules, $_scriptName=null, $utf7imap_fileinto=false)
	{
		$script = $this->retrieveRules($_scriptName);
		$script->debug = $this->debug;
		$script->rules = $_rules;
		$ret = $script->updateScript($this, $utf7imap_fileinto);
		$this->error = $script->errstr;
		return $ret;
	}

	/**
	 * Set email notifications
	 *
	 * @param array $_vacation
	 * @param string $_scriptName
	 */
	function setVacation(array $_vacation, $_scriptName=null, &$vaction_rule=null, $throw_exception=false)
	{
		if ($this->debug)
		{
			error_log(__METHOD__ . "($_scriptName," . print_r($_vacation, true) . ')');
		}
		$script = $this->retrieveRules($_scriptName);
		$script->debug = $this->debug;
		$script->vacation = $_vacation;
		$ret = $script->updateScript($this, false, $vaction_rule, $throw_exception);
		$this->error = $script->errstr;
		return $ret;
	}

	/**
	 * Set email notifications
	 *
	 * @param array $_emailNotification
	 * @param string $_scriptName
	 * @return Script
	 */
	function setEmailNotification(array $_emailNotification, $_scriptName=null)
	{
		if ($_emailNotification['externalEmail'] == '' || !preg_match("/\@/",$_emailNotification['externalEmail'])) {
    		$_emailNotification['status'] = 'off';
    		$_emailNotification['externalEmail'] = '';
    	}

    	$script = $this->retrieveRules($_scriptName);
   		$script->emailNotification = $_emailNotification;
		$ret = $script->updateScript($this);
		$this->error = $script->errstr;
		return $ret;
	}

	/**
	 * Retrive rules, vacation, notifications and return Script object to update them
	 *
	 * @param string $_scriptName
	 * @return Script
	 */
	function retrieveRules($_scriptName=null)
	{
		if (!$_scriptName)
		{
			// query active script from Sieve server
			if (empty($this->scriptName))
			{
				try {
					$this->scriptName = $this->getActive();
				}
				catch(\Exception $e) {
					unset($e);	// ignore NOTEXISTS exception
				}
				if (empty($this->scriptName))
				{
					$this->scriptName = self::DEFAULT_SCRIPT_NAME;
				}
			}
			$_scriptName = $this->scriptName;
		}
		$script = new Script($_scriptName);

		try {
			$script->retrieveRules($this);
		}
		catch (\Exception $e) {
			unset($e);	// ignore not found script exception
		}
		$this->script =& $script->script;
		$this->rules =& $script->rules;
		$this->vacation =& $script->vacation;
		$this->emailNotification =& $script->emailNotification; // Added email notifications

		return $script;
	}
}