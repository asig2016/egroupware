<?php

namespace EGroupware\Api\Etemplate\Widget;

use EGroupware\Api;
use EGroupware\Api\Etemplate;
use EGroupware\Api\Framework;

class Aclink extends Etemplate\Widget\Link
{
	function __construct($xml='') {

		parent::__construct($xml);

		$css_file = '/achelper/templates/default/widget_aclink.css';
		Framework::includeCSS($css_file);

	}

}
