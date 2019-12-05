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
        Framework::includeJS('.', '/achelper/vendor/vakata/jstree/dist/jstree.min.js', 'achelper');
        Framework::includeCSS('/achelper/vendor/vakata/jstree/dist/themes/default/style.css');
        Framework::includeCSS('/achelper/templates/default/widget_actree.css');
        Framework::includeCSS('/achelper/templates/default/widget_ac.css');
    }
}
