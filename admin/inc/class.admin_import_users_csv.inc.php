<?php
/**
 * EGroupware admin
 *
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 * @package admin
 * @link http://www.egroupware.org
 * @author Nathan Gray
 * @copyright Nathan Gray
 * @version $Id$
 */

use EGroupware\Api;

/**
 * class import_csv for admin (users)
 */
class admin_import_users_csv extends importexport_basic_import_csv
{
	/**
	 * actions which could be done to data entries
	 */
	protected static $actions = array( 'none', 'update', 'create', 'delete', 'disable', 'enable' );

	/**
	 * conditions for actions
	 *
	 * @var array
	 */
	protected static $conditions = array( 'exists' );

	protected static $record_class = "admin_egw_user_record";

	/**
	 * imports entries according to given definition object.
	 * @param resource $_stream
	 * @param string $_charset
	 * @param definition $_definition
	 */
	public function init(importexport_definition $definition, importexport_import_csv $import_csv = null)
	{
		parent::init($definition, $import_csv); // TODO: Change the autogenerated stub

		$this->lookups['account_status'] = array('A' => lang('Active'), '' => lang('Disabled'),
												 'D' => lang('Disabled'));
	}

	protected function import_record(importexport_iface_egw_record &$record, &$import_csv)
	{
		$success = false;
		// don't import empty records
		if(count(array_unique($record->get_record_array())) < 2)
		{
			return $success;
		}

		if(strtolower($record->account_expires) == 'never')
		{
			$record->account_expires = -1;
		}

		if($this->definition->plugin_options['conditions'])
		{
			foreach($this->definition->plugin_options['conditions'] as $condition)
			{
				switch($condition['type'])
				{
					// exists
					case 'exists' :
						$accounts = array();
						// Skip the search if the field is empty
						if($record->$condition['string'] !== '')
						{
							$accounts = $GLOBALS['egw']->accounts->search(array(
																			  'type'       => 'accounts',
																			  'query'      => $record->$condition['string'],
																			  'query_type' => $condition['string']
																		  ));
						}
						// Search looks in the given field, but doesn't do an exact match
						foreach((array)$accounts as $key => $account)
						{
							if($account[$condition['string']] != $record->$condition['string'])
							{
								unset($accounts[$key]);
							}
						}
						if(is_array($accounts) && count($accounts) >= 1)
						{
							// apply action to all contacts matching this exists condition
							$action = $condition['true'];
							foreach((array)$accounts as $account)
							{
								$record->account_id = $account['account_id'];
								$success = $this->admin_action($action['action'], $record->get_record_array(), $import_csv->get_current_position(), $admin_cmd);
							}
						}
						else
						{
							$action = $condition['false'];
							$success = ($this->admin_action($action['action'], $record->get_record_array(), $import_csv->get_current_position(), $admin_cmd));
						}
						break;

					// not supported action
					default :
						die('condition / action not supported!!!');
				}
				if($action['last'])
				{
					break;
				}
			}
		}
		else
		{
			// unconditional insert
			$success = $this->admin_action('create', $record->get_record_array(), $import_csv->get_current_position(), $admin_cmd);
		}

		return $success;
	}

	protected function action($_action, importexport_iface_egw_record &$record, $record_num = 0)
	{
		// Not used, see admin_action()
	}

	/**
	 * perform the required action
	 *
	 * @param int $_action one of $this->actions
	 * @param array $_data contact data for the action
	 * @return bool success or not
	 */
	private function admin_action($_action, $_data, $record_num = 0, $admin_cmd)
	{
		switch ($_action) {
			case 'none' :
				return true;
			case 'disable':
			case 'enable':
				$_data['account_expires'] = $_action == 'disable' ? 'already' : '';
			case 'update' :
				$old = $GLOBALS['egw']->accounts->read($_data['account_id']);
				if($old)
				{
					$old['account_passwd'] = $old['account_pwd']; unset($old['account_pwd']);
					$old['account_groups'] = implode(',',$GLOBALS['egw']->accounts->memberships($_data['account_id'], true));
					// Limit history to what actually changed
					$old = array_intersect_key($old, $_data);
				}
			case 'create' :
				$command = new admin_cmd_edit_user(array(
					'account' => $_action=='create'?null:(int)$_data['account_id'],
					'set' => $_data,
					'old' => $_action=='create'?null:$old
				)+(array)$admin_cmd);


				if($this->dry_run) {
					$this->results[$_action]++;
					return true;
				}
				try {
					$command->run();
				} catch (Exception $e) {
					$this->errors[$record_num] = $e->getMessage();
					return false;
				}
				$this->results[$_action]++;
				return true;
			default:
				throw new Api\Exception('Unsupported action');

		}
	}

	/**
	 * returns translated name of plugin
	 *
	 * @return string name
	 */
	public static function get_name() {
		return lang('User CSV import');
	}

	/**
	 * returns translated (user) description of plugin
	 *
	 * @return string descriprion
	 */
	public static function get_description() {
		return lang("Creates / updates user accounts from CSV file");
	}

	/**
	 * retruns file suffix(s) plugin can handle (e.g. csv)
	 *
	 * @return string suffix (comma seperated)
	 */
	public static function get_filesuffix() {
		return 'csv';
	}

	/**
	 * return etemplate components for options.
	 * @abstract We can't deal with etemplate objects here, as an uietemplate
	 * objects itself are scipt orientated and not "dialog objects"
	 *
	 * @return array (
	 * 		name 		=> string,
	 * 		content		=> array,
	 * 		sel_options => array,
	 * 		preserv		=> array,
	 * )
	 */
	public function get_options_etpl(importexport_definition &$definition=null)
	{
		// lets do it!
	}

	/**
	 * returns etemplate name for slectors of this plugin
	 *
	 * @return string etemplate name
	 */
	public function get_selectors_etpl() {
		// lets do it!
	}

	/**
	* Returns warnings that were encountered during importing
	* Maximum of one warning message per record, but you can concatenate them if you need to
	*
	* @return Array (
	*       record_# => warning message
	*       )
	*/
	public function get_warnings() {
		return $this->warnings;
	}

	/**
	* Returns errors that were encountered during importing
	* Maximum of one error message per record, but you can append if you need to
	*
	* @return Array (
	*       record_# => error message
	*       )
	*/
	public function get_errors() {
		return $this->errors;
	}

	/**
	* Returns a list of actions taken, and the number of records for that action.
	* Actions are things like 'insert', 'update', 'delete', and may be different for each plugin.
	*
	* @return Array (
	*       action => record count
	* )
	*/
	public function get_results() {
		return $this->results;
	}
}