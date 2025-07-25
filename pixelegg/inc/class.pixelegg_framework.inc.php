<?php
/**
 * EGroupware: Stylite Pixelegg template
 *
 * et2 Messages
 *
 * Please do NOT change css-files directly, instead change less-files and compile them!
 *
 * @link http://www.egroupware.org
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 * @author Stefan Reinhard <stefan.reinhard@pixelegg.de>
 * @package pixelegg
 * @version $Id$
 */

use EGroupware\Api;

/**
* Stylite Pixelegg template
*/
class pixelegg_framework extends Api\Framework\Ajax
{
	/**
	 * Appname used for everything but JS includes, which we re-use from jdots
	 */
	const APP = 'pixelegg';
	/**
	 * Appname used to include javascript code
	 */
	const JS_INCLUDE_APP = 'pixelegg';

	/**
	 * Enable to use this template sets login.tpl for login page
	 */
	const LOGIN_TEMPLATE_SET = true;

	/**
	 * Constructor
	 *
	 * Overwritten to set own app/template name (parent can NOT use static::APP!)
	 *
	 * @param string $template ='pixelegg' name of the template
	 */
	function __construct($template=self::APP)
	{
		parent::__construct($template);		// call the constructor of the extended class

		// search 'mobile' dirs first
		if (Api\Header\UserAgent::mobile()) array_unshift ($this->template_dirs, 'mobile');
	}

	/**
	 * Make given color lighter or darker by percentage
	 *
	 * @param string $color in hex
	 * @param int $percent int
	 * @return string returns color hex format (for instance: #2b2b2b)
	 */
	function _color_shader($color, $percent)
	{
		if ($color[0] == '#') $color = ltrim($color, '#');

		$R = hexdec(substr($color,0,2));
		$G = hexdec(substr($color,2,2));
		$B = hexdec(substr($color,4,2));

		$Rs = round($R * (100 + $percent) / 100);
		$Gs = round($G * (100 + $percent) / 100);
		$Bs = round($B * (100 + $percent) / 100);

		if ($Rs > 255) $Rs = 255;
		if ($Gs > 255) $Gs = 255;
		if ($Bs > 255) $Bs = 255;

		return '#'.sprintf('%02X%02X%02X', $Rs, $Gs, $Bs);
	}

	/**
	 * Overwrite to NOT add customizable colors from jDots
	 *
	 * @param array $themes_to_check
	 * @return array
	 *@see Api\Framework::_get_css()
	 */
	public function _get_css(array $themes_to_check = array())
	{
		$ret = parent::_get_css($themes_to_check);
		// color to use
		$color = str_replace('custom', $GLOBALS['egw_info']['user']['preferences']['common']['template_custom_color'] ?? null,
			$GLOBALS['egw_info']['user']['preferences']['common']['template_color'] ?? null);

		// Create a dark variant of the color
		$color_darker = empty($color) ? '' :$this->_color_shader($color, -30);

		if (!empty($GLOBALS['egw_info']['user']['preferences']['common']['sidebox_custom_color']) && preg_match('/^(#[0-9A-F]+|[A-Z]+)$/i', $GLOBALS['egw_info']['user']['preferences']['common']['sidebox_custom_color']))
		{
			$sidebox_color_hover = $GLOBALS['egw_info']['user']['preferences']['common']['sidebox_custom_color'];
			$sidebox_color = $this->_color_shader($sidebox_color_hover, -30);
		}
		else
		{
			$sidebox_color_hover = $color;
			$sidebox_color = $color_darker;
		}
		if (!empty($GLOBALS['egw_info']['user']['preferences']['common']['loginbox_custom_color']) && preg_match('/^(#[0-9A-F]+|[A-Z]+)$/i', $GLOBALS['egw_info']['user']['preferences']['common']['loginbox_custom_color']))
		{
			$loginbox_color = $GLOBALS['egw_info']['user']['preferences']['common']['loginbox_custom_color'];
		}
		else
		{
			$loginbox_color = $color_darker;
		}
		// custom web-font
		$ret['app_css'] .= self::web_fonts();

		//always set header logo used  in sharing regardless of custom color being set
		$header = !empty($GLOBALS['egw_info']['server']['login_logo_header']) ? Api\Framework::get_login_logo_or_bg_url('login_logo_header', 'logo')
			: Api\Framework::get_login_logo_or_bg_url('login_logo_file', 'logo');
		$ret['app_css'] .= "
			/*
			sharing
			*/
			div#popupMainDiv:after {
				background-image: url($header);
			}
		";
		$textsize = $GLOBALS['egw_info']['user']['preferences']['common']['textsize'] ?? '12';
		$ret['app_css'] .= "
			:root, :host, body, input {
				font-size: {$textsize}px;
				font-family: egroupware, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
					Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
			}
		";
		if (!empty($textsize) && is_numeric($textsize) && $textsize != '12')
		{
			$iconSize = $textsize+2;
			$ret['app_css'] .= "
			/*
			sharing
			*/
			body,
			#egw_fw_sidebar #egw_fw_sidemenu .egw_fw_ui_sidemenu_entry_header h1,
			#egw_fw_main #egw_fw_tabs .egw_fw_ui_tabs_header .egw_fw_ui_tab_header h1,
			 #egw_fw_sidebar #egw_fw_sidemenu .egw_fw_ui_sidemenu_entry_content .egw_fw_ui_category_active h2,
			 #egw_fw_sidebar #egw_fw_sidemenu .egw_fw_ui_sidemenu_entry_content .egw_fw_ui_category h2,
			 table.egwGridView_grid, .calendar_calTimeRow .calendar_calTimeRowTime, .calendar_calGridHeader .calendar_calDayColHeader > div[data-date],
			 .selectedTreeRow, .standartTreeRow, .standartTreeRow_lor, .selectedTreeRow_lor{
				font-size: {$textsize}px;
				--sl-font-size-medium: {$textsize}px;
			}
			et2-lavatar, et2-avatar {font-size: 12px}
			#egw_fw_header #egw_fw_topmenu #egw_fw_topmenu_items ul a {background-position:left;background-size:{$iconSize}px}
		";
		}
		if (preg_match('/^(#[0-9A-F]+|[A-Z]+)$/i',$color) || preg_match('/^(#[0-9A-F]+|[A-Z]+)$/i',$loginbox_color))	// a little xss check
		{
			if (!Api\Header\UserAgent::mobile())
			{
				$ret['app_css'] .= "
/**
 * theme changes to color pixelegg for color: $color
 */
/*
sharing
*/
div#popupMainDiv:before {
	background-color: $color;
}
/*
-Top window framework header
-sidebar actiuve category :hover
-popup toolbar
*/
div#egw_fw_header, div.egw_fw_ui_category:hover,#loginMainDiv,
.et2_portlet .ui-widget-header{
	background-color: $color !important;
}

/*Login background*/
#loginMainDiv #divAppIconBar #divLogo img[src$='svg'] {
	background-color: $color;
}

/*Center box in login page*/
#loginMainDiv div#centerBox form{
	background-color: $loginbox_color;
}

/*Sidebar menu active category*/
#egw_fw_sidebar #egw_fw_sidemenu .egw_fw_ui_category_active:hover{
	background-color: $sidebox_color_hover !important;
}
#egw_fw_sidebar #egw_fw_sidemenu .egw_fw_ui_category_active{
	background-color: $sidebox_color !important;
}
.ui-datepicker div.ui-timepicker-div div.ui_tpicker_minute_slider span.ui-slider-handle,
.ui-datepicker table.ui-datepicker-calendar .ui-state-active,
.ui-datepicker div.ui-timepicker-div div.ui_tpicker_hour_slider span.ui-slider-handle,
.ui-widget-header {background-color: $sidebox_color;}
";
			}
			else
			/* Mobile theme custom colors*/
			{
				$ret['app_css'] .= "
/* Mobile theme specific color changes */

/*nextmatch header and plus_button in mobile theme*/
body div.et2_nextmatch .search,
body div.et2_nextmatch .search button,
body button.plus_button,
body div.et2_nextmatch .search .nm_action_header,
body div.et2_nextmatch .search .nm_toggle_header,
body div.et2_nextmatch .search .nm_favorites_button,
body #loginMainDiv,
body #egw_fw_firstload,
body .dialogHeadbar{
	background-color: $color;
}
body #egw_fw_sidebar #egw_fw_sidemenu .egw_fw_ui_category_active{background-color: $sidebox_color !important};
";
			}
		}
		return $ret;
	}

	/**
	 * Return CSS to load and define our custom web-fonts as font-family: egroupware(2)
	 *
	 * @return string
	 */
	public static function web_fonts()
	{
		$css = '';
		// custom web-font
		foreach([
			        'egroupware' => $GLOBALS['egw_info']['server']['font_face_url'] ?? null,
			        'egroupware2' => $GLOBALS['egw_info']['server']['font_face_url2'] ?? null,
		        ] as $family => $url)
		{
			if ($url)
			{
				$css .= '
	@font-face {
		font-family: '.$family.';
		src: url("'.htmlspecialchars(is_array($url) ? array_shift($url) : $url).'") format("woff2");
	}
';
			}
		}
		return $css;
	}

	/**
	 * displays a login screen
	 *
	 * Reimplemented to remove site_title from login box and display it as loginscreenmessage, if none set.
	 *
	 * @param string $extra_vars for login url
	 * @param string $change_passwd =null string with message to render input fields for password change
	 */
	function login_screen($extra_vars, $change_passwd=null)
	{
		if (empty($GLOBALS['loginscreenmessage']))
		{
			$GLOBALS['loginscreenmessage'] = $GLOBALS['egw_info']['server']['site_title'];
		}
		unset($GLOBALS['egw_info']['server']['site_title']);

		return parent::login_screen($extra_vars, $change_passwd);
	}
}