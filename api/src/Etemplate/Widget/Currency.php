<?php
/**
 * EGroupware - eTemplate serverside textbox widget
 *
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 * @package api
 * @subpackage etemplate
 * @link http://www.egroupware.org
 * @author Ralf Becker <RalfBecker@outdoor-training.de>
 * @copyright 2002-16 by RalfBecker@outdoor-training.de
 * @version $Id$
 */

namespace EGroupware\Api\Etemplate\Widget;

use EGroupware\Api\Etemplate;
use XMLReader;

/**
 * eTemplate currency textbox
 * Supports formatting for decimal & thousands, and currency prefix/suffix
 */
class Currency extends Etemplate\Widget
{
	public function set_attrs($xml, $cloned=true)
	{
		parent::set_attrs($xml, $cloned);

		// Legacy handling only
		// A negative size triggered the HTML readonly attibute, but not etemplate readonly,
		// so you got an input element, but it was not editable.
		if ($this->attrs['size'] < 0)
		{
			$this->setElementAttribute($this->id, 'size', abs($this->attrs['size']));
			self::$request->readonlys[$this->id] = false;
			$this->setElementAttribute($this->id, 'readonly', true);
			trigger_error("Using a negative size to set textbox readonly. " .$this, E_USER_DEPRECATED);
		}
		return $this;
	}

	public function beforeSendToClient($cname, array $expand=null)
	{
		$form_name = self::form_name($cname, $this->id, $expand);
		$value =& self::get_array(self::$request->content, $form_name);

		// Prepare value for UI, so decimals will always appear 
		if ( $value )
			$value = number_format( $value, 2, '.', '');
	}

	public function validate($cname, array $expand, array $content, &$validated=array())
	{
		$form_name = self::form_name($cname, $this->id, $expand);

		if (!$this->is_readonly($cname, $form_name))
		{
			if (!isset($this->attrs['validator']))
			{
				switch($this->type)
				{
				case 'int':
				case 'integer':
					$this->attrs['validator'] = '/^-?[0-9]*$/';
					break;
				case 'float':
					$this->attrs['validator'] = '/^-?[0-9]*[,.]?[0-9]*$/';
					break;
				case 'colorpicker':
					$this->attrs['validator'] = '/^(#[0-9a-f]{6}|)$/i';
					break;
				}
			}

			$value = $value_in = self::get_array($content, $form_name);

			// passwords are not transmitted back to client (just asterisks)
			// therefore we need to replace it again with preserved value
			if (($this->attrs['type'] == 'passwd' || $this->type == 'passwd'))
			{
				$preserv = self::get_array(self::$request->preserv, $form_name);
				if ($value == str_repeat('*', strlen($preserv)))
				{
					$value = $preserv;
				}
			}

			if ((string)$value === '' && $this->attrs['needed'])
			{
				self::set_validation_error($form_name,lang('Field must not be empty !!!'),'');
			}
			if ((int) $this->attrs['maxlength'] > 0 && mb_strlen($value) > (int) $this->attrs['maxlength'])
			{
				$value = mb_substr($value,0,(int) $this->attrs['maxlength']);
			}
			if ($this->attrs['validator'] && !preg_match($this->attrs['validator'],$value))
			{
				switch($this->type)
				{
				case 'integer':
					self::set_validation_error($form_name,lang("'%1' is not a valid integer !!!",$value),'');
					break;
				case 'float':
					self::set_validation_error($form_name,lang("'%1' is not a valid floatingpoint number !!!",$value),'');
					break;
				default:
					self::set_validation_error($form_name,lang("'%1' has an invalid format !!!",$value)/*." !preg_match('$this->attrs[validator]', '$value')"*/,'');
					break;
				}
			}
			elseif ($this->type == 'integer' || $this->type == 'float')	// cast int and float and check range
			{
				if ((string)$value !== '' || $this->attrs['needed'])	// empty values are Ok if needed is not set
				{
					$value = $this->type == 'integer' ? (int) $value : (float) str_replace(',','.',$value);	// allow for german (and maybe other) format

					if (!empty($this->attrs['min']) && $value < $this->attrs['min'])
					{
						self::set_validation_error($form_name,lang("Value has to be at least '%1' !!!",$this->attrs['min']),'');
						$value = $this->type == 'integer' ? (int) $this->attrs['min'] : (float) $this->attrs['min'];
					}
					if (!empty($this->attrs['max']) && $value > $this->attrs['max'])
					{
						self::set_validation_error($form_name,lang("Value has to be at maximum '%1' !!!",$this->attrs['max']),'');
						$value = $this->type == 'integer' ? (int) $this->attrs['max'] : (float) $this->attrs['max'];
					}
				}
			}
			if (isset($value))
			{
				self::set_array($validated, $form_name, $value);
				//error_log(__METHOD__."() $form_name: ".array2string($value_in).' --> '.array2string($value));
			}
		}
	}
}
Etemplate\Widget::registerWidget(__NAMESPACE__.'\\Currency', array('currency'));
