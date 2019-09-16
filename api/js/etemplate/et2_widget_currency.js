/**
 * EGroupware eTemplate2 - JS Currency object
 *
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 * @package etemplate
 * @subpackage api
 * @link http://www.egroupware.org
 * @author Filippos Karailanidis
 * @version $Id$
 */

/*egw:uses
	et2_core_inputWidget;
	/vendor/bower-asset/jquery/dist/jquery.js;
	/api/js/jquery/inputmask/jquery.inputmask.bundle.js;
	/api/js/jquery/inputmask/jquery.inputmask.bundle.min.js;
*/

/**
 * Class which implements the "currency" XET-Tag
 * It's a textbox with masking, which allows for better number input when it's related to currencies
 *
 * @augments et2_inputWidget
 */
var et2_currency = (function(){ "use strict"; return et2_inputWidget.extend([et2_IResizeable],
{
	attributes: {
		"size": {
			"name": "Size",
			"type": "integer",
			"default": et2_no_init,
			"description": "Field width"
		},
		"maxlength": {
			"name": "Maximum length",
			"type": "integer",
			"default": et2_no_init,
			"description": "Maximum number of characters allowed"
		},
		"blur": {
			"name": "Placeholder",
			"type": "string",
			"default": "",
			"description": "This text get displayed if an input-field is empty and does not have the input-focus (blur). It can be used to show a default value or a kind of help-text."
		},
		"thousands": {
			"name": "Thousands separator",
			"type": "string",
			"default": ".",
			"description": "Symbol to separate thousands in a number. eg. in 1.222.222 "
		},
		"decimal": {
			"name": "Decimal separator",
			"type": "string",
			"default": ",",
			"description": "Symbol to separate decimals in a number. eg. in 1,22 "
		},
		"prefix": {
			"name": "Currency prefix",
			"type": "string",
			"default": "",
			"description": "Symbol to use as prefix. eg. $1,22 "
		},
		"suffix": {
			"name": "Currency suffix",
			"type": "string",
			"default": "",
			"description": "Symbol to use as suffix. eg. 1,22€ "
		},
		"min": {
			"name": "Minimum amount",
			"type": "float",
			"default": et2_no_init,
			"description": "Minimum amount allowed"
		},
		"max": {
			"name": "Maximum amount",
			"type": "float",
			"default": et2_no_init,
			"description": "Maximum amount allowed"
		},
		"digits": {
			"name": "Decimal digits",
			"type": "integer",
			"default": 2,
			"description": "Number of decimal digits"
		},
		onkeypress: {
			name: "onKeypress",
			type: "js",
			default: et2_no_init,
			description: "JS code or app.$app.$method called when key is pressed, return false cancels it."
		}
	},

	legacyOptions: ["size", "maxlength", "validator"],

	/**
	 * Constructor
	 *
	 * @memberOf et2_currency
	 */
	init: function() {
		this._super.apply(this, arguments);

		this.input = null;

		this.createInputWidget();
	},

	createInputWidget: function() {
		this.input = jQuery(document.createElement("input"));
		this.input.addClass("et2_currency");
		this.setDOMNode(this.input[0]);

		if(this.options.size)
		{
			this.set_size(this.options.size);
		}
		if(this.options.blur)
		{
			this.set_blur(this.options.blur);
		}
		if(this.options.readonly)
		{
			this.set_readonly(true);
		}
		if(this.options.value)
		{
			this.set_value(this.options.value);
		}

		if (this.options.onkeypress && typeof this.options.onkeypress == 'function')
		{
			var self = this;
			this.input.keypress(function(_ev)
			{
				return self.options.onkeypress.call(this, _ev, self);
			});
		}

		// Initialize inputmask plugin
		var params = {
			radixPoint: this.options.decimal,
			groupSeparator: this.options.thousands,
			digits: this.options.digits,
			prefix: this.options.prefix,
			suffix: this.options.suffix,
			min: this.options.min,
			max: this.options.max,
			rightAlign: true,
			autoGroup: true,
			autoUnmask: true,
		};

		this.input.inputmask("numeric", params);
	},

	destroy: function() {
		var node = this.getInputNode();
		if (node) jQuery(node).unbind("keypress");

		this._super.apply(this, arguments);
	},

	getValue: function()
	{
		if(this.options && this.options.blur && this.input.val() == this.options.blur) return "";
		var node = this.getInputNode();

		// Remove mask to pass as value
		var value = jQuery( node ).val();

		//PHP only accepts . as decimal separator
		var replaced = value.replace( this.options.decimal, '.' );

		return replaced;
	},

	/**
	 * Set input widget size
	 * @param _size Rather arbitrary size units, approximately characters
	 */
	set_size: function(_size) {
		if (this.options.multiline || this.options.rows > 1 || this.options.cols > 1)
		{
			this.input.css('width', _size + "em");
		}
		else if (typeof _size != 'undefined' && _size != this.input.attr("size"))
		{
			this.size = _size;
			this.input.attr("size", this.size);
		}
	},

	/**
	 * Set maximum characters allowed
	 * @param _size Max characters allowed
	 */
	set_maxlength: function(_size) {
		if (typeof _size != 'undefined' && _size != this.input.attr("maxlength"))
		{
			this.maxLength = _size;
			this.input.attr("maxLength", this.maxLength);
		}
	},

	/**
	 * Set HTML readonly attribute.
	 * Do not confuse this with etemplate readonly, which would use et_currency_ro instead
	 * @param _readonly Boolean
	 */
	set_readonly: function(_readonly) {
		this.input.attr("readonly", _readonly);
		this.input.toggleClass('et2_currency_ro', _readonly);
	},

	set_blur: function(_value) {
		if(_value) {
			this.input.attr("placeholder", this.egw().lang(_value) + "");	// HTML5
			if(!this.input[0].placeholder) {
				// Not HTML5
				if(this.input.val() == "") this.input.val(this.egw().lang(this.options.blur));
				this.input.focus(this,function(e) {
					if(e.data.input.val() == e.data.egw().lang(e.data.options.blur)) e.data.input.val("");
				}).blur(this, function(e) {
					if(e.data.input.val() == "") e.data.input.val(e.data.egw().lang(e.data.options.blur));
				});
			}
		} else {
			if (!this.getValue()) this.input.val('');
			this.input.removeAttr("placeholder");
		}
		this.options.blur = _value;
	},

	resize: function (_height)
	{
		if (_height && this.options.multiline)
		{
			// apply the ratio
			_height = (this.options.resize_ratio != '')? _height * this.options.resize_ratio: _height;
			if (_height != 0)
			{
				this.input.height(this.input.height() + _height);
				// resize parent too, so mailvelope injected into parent inherits its height
				this.input.parent().height(this.input.parent().height()+_height);
			}
		}
	}
});}).call(this);
et2_register_widget(et2_currency, ["currency"]);
