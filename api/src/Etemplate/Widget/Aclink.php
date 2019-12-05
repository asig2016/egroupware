<?php

namespace EGroupware\Api\Etemplate\Widget;

use EGroupware\Api;
use EGroupware\Api\Etemplate;
use EGroupware\Api\Framework;

class Aclink extends Link
{
    public function __construct($xml='') {

        parent::__construct($xml);

        Framework::includeCSS('/achelper/templates/default/widget_aclink.css');
        Framework::includeCSS('/achelper/templates/default/widget_ac.css');
    }
}
