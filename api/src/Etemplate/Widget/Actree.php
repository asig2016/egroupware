<?php

namespace EGroupware\Api\Etemplate\Widget;

use EGroupware\Api;
use EGroupware\Api\Etemplate;
use EGroupware\Api\Framework;

class Actree extends Link
{
    public function __construct($xml='')
    {
        parent::__construct($xml);
        Framework::includeJS('.', '/vendor/vakata/jstree/dist/jstree.js', 'achelper');
        Framework::includeCSS('/vendor/vakata/jstree/dist/themes/default/style.css');
        Framework::includeCSS('/achelper/templates/default/widget_actree.css');
        Framework::includeCSS('/achelper/templates/default/widget_ac.css');
    }
}
