/**
 * EGroupware eTemplate2 - Description WebComponent
 *
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 * @package api
 * @link https://www.egroupware.org
 * @author Nathan Gray
 */


import {LionSelect} from "@lion/select";
import {Et2InputWidget} from "../Et2InputWidget/Et2InputWidget";
import {et2_readAttrWithDefault} from "../et2_core_xml";
import {css, html, render, repeat, TemplateResult} from "@lion/core";
import {cssImage} from "../Et2Widget/Et2Widget";

export interface SelectOption
{
	value : String;
	label : String;
	// Hover help text
	title? : String;
}

/**
 * LionSelect (and any other LionField) use slots to wrap a real DOM node.  ET2 doesn't expect this,
 * so we have to create the input node (via slots()) and respect that it is _external_ to the Web Component.
 * This complicates things like adding the options, since we can't just override _inputGroupInputTemplate()
 * and include them when rendering - the parent expects to find the <select> added via a slot, render() would
 * put it inside the shadowDOM.  That's fine, but then it doesn't get created until render(), and the parent
 * (LionField) can't find it when it looks for it before then.
 */
export class Et2Select extends Et2InputWidget(LionSelect)
{
	protected _options : SelectOption[] = [];

	static get styles()
	{
		return [
			...super.styles,
			css`
			:host {
				display: inline-block;
			}
			select {
				color: var(--input-text-color, #26537c);
				border-radius: 3px;
				flex: 1 0 auto;
				padding-top: 4px;
				padding-bottom: 4px;
				padding-right: 20px;
				border-width: 1px;
				border-style: solid;
				border-color: #e6e6e6;
				-webkit-appearance: none;
				-moz-appearance: none;
				margin: 0;
				background: #fff no-repeat center right;
				background-image: ${cssImage('arrow_down')};
				background-size: 8px auto;
				background-position-x: calc(100% - 8px);
				text-indent: 5px;
			}

			select:hover {
				box-shadow: 1px 1px 1px rgb(0 0 0 / 60%);
			}`
		];
	}

	static get properties()
	{
		return {
			...super.properties,
			/**
			 * Textual label for first row, eg: 'All' or 'None'.  It's value will be ''
			 */
			empty_label: String,

			select_options: Object
		}
	}

	constructor()
	{
		super();
	}

	connectedCallback()
	{
		super.connectedCallback();

		// Add in actual options as children to select, if not already there
		if(this._inputNode.children.length == 0)
		{
			render(html`${this._emptyLabelTemplate()}
                    ${repeat(this.get_select_options(), (option : SelectOption) => option.value, this._optionTemplate)}`,
				this._inputNode
			);
		}
	}

	/**
	 * Set the ID of the widget
	 *
	 * Overridden from parent to update select options
	 *
	 * @param {string} value
	 */
	set id(value)
	{
		let oldValue = this.id;
		super.id = value;
		if(value !== oldValue)
		{
			this.set_select_options(find_select_options(this));
		}
	}

	/**
	 * Get the ID of the widget
	 * Overridden from parent because we overrode setter
	 *
	 * @returns {string}
	 */
	get id()
	{
		return this._widget_id;
	}

	getValue()
	{
		return this.readOnly ? null : this.value;
	}


	/**
	 * Set the select options
	 *
	 * @param {SelectOption[]} new_options
	 */
	set_select_options(new_options : SelectOption[] | { [key : string] : string })
	{
		if(!Array.isArray(new_options))
		{
			let fixed_options = [];
			for(let key in new_options)
			{
				fixed_options.push({value: key, label: new_options[key]});
			}
			this._options = fixed_options;
		}
		else
		{
			this._options = new_options;
		}
		// Add in actual options as children to select
		if(this._inputNode)
		{
			render(html`${this._emptyLabelTemplate()}
                    ${repeat(this.get_select_options(), (option : SelectOption) => option.value, this._optionTemplate)}`,
				this._inputNode
			);
		}
	}

	get_select_options()
	{
		return this._options;
	}

	get slots()
	{
		return {
			...super.slots,
			input: () =>
			{
				return document.createElement("select");
			}
		}
	}

	_emptyLabelTemplate() : TemplateResult
	{
		if(!this.empty_label)
		{
			return html``;
		}
		return html`
            <option value="">${this.empty_label}</option>`;
	}

	_optionTemplate(option : SelectOption) : TemplateResult
	{
		return html`
            <option value="${option.value}" title="${option.title}">${option.label}</option>`;
	}

	loadFromXML(_node : Element)
	{
		// Read the option-tags
		let options = _node.querySelectorAll("option");
		let new_options = this._options;
		for(let i = 0; i < options.length; i++)
		{
			new_options.push({
				value: et2_readAttrWithDefault(options[i], "value", options[i].textContent),
				// allow options to contain multiple translated sub-strings eg: {Firstname}.{Lastname}
				label: options[i].textContent.replace(/{([^}]+)}/g, function(str, p1)
				{
					return this.egw().lang(p1);
				}),
				title: et2_readAttrWithDefault(options[i], "title", "")
			});
		}

		this.set_select_options(new_options);
	}

	transformAttributes(_attrs)
	{
		super.transformAttributes(_attrs);

		// If select_options are already known, skip the rest
		if(this._options && this._options.length > 0 ||
			_attrs.select_options && Object.keys(_attrs.select_options).length > 0 ||
			// Allow children to skip select_options - check to make sure default got set to something (should be {})
			typeof _attrs.select_options == 'undefined' || _attrs.select_options === null
		)
		{
			// do not return inside nextmatch, as get_rows data might have changed select_options
			// for performance reasons we only do it for first row, which should have id "0[...]"
			if(this.getParent() && this.getParent().getType() != 'rowWidget' || !_attrs.id || _attrs.id[0] != '0')
			{
				return;
			}
		}

		let sel_options = find_select_options(this, _attrs['select_options'], _attrs);
		if(sel_options.length > 0)
		{
			this.set_select_options(sel_options);
		}
	}

}


/**
 * Find the select options for a widget, out of the many places they could be.
 * @param {Et2Widget} widget to check for.  Should be some sort of select widget.
 * @param {object} attr_options Select options in attributes array
 * @param {object} attrs Widget attributes
 * @return {object} Select options, or empty object
 */
export function find_select_options(widget, attr_options?, attrs?)
{
	let name_parts = widget.id.replace(/&#x5B;/g, '[').replace(/]|&#x5D;/g, '').split('[');

	let type_options : SelectOption[] = [];
	let content_options : SelectOption[] = [];

	// First check type, there may be static options.
	// TODO
	/*
	var type = widget._type;
	var type_function = type.replace('select-', '').replace('taglist-', '').replace('_ro', '') + '_options';
	if(typeof this[type_function] == 'function')
	{
		var old_type = widget._type;
		widget._type = type.replace('taglist-', 'select-');
		if(typeof attrs.other == 'string')
		{
			attrs.other = attrs.other.split(',');
		}
		// Copy, to avoid accidental modification
		//
		// type options used to use jQuery.extend deep copy to get a clone object of options
		// but as jQuery.extend deep copy is very expensive operation in MSIE (in this case almost 400ms)
		// we use JSON parsing instead to copy the options object
		type_options = this[type_function].call(this, widget, attrs);
		try
		{
			type_options = JSON.parse(JSON.stringify(type_options));
		}
		catch(e)
		{
			egw.debug(e);
		}

		widget._type = old_type;
	}

	 */

	// Try to find the options inside the "sel-options"
	if(widget.getArrayMgr("sel_options"))
	{
		// Try first according to ID
		let options = widget.getArrayMgr("sel_options").getEntry(widget.id);
		// ID can get set to an array with 0 => ' ' - not useful
		if(options && (options.length == 1 && typeof options[0] == 'string' && options[0].trim() == '' ||
			// eg. autorepeated id "cat[3]" would pick array element 3 from cat
			typeof options.value != 'undefined' && typeof options.label != 'undefined' && widget.id.match(/\[\d+]$/)))
		{
			content_options = null;
		}
		else
		{
			content_options = options;
		}
		// We could wind up too far inside options if label,title are defined
		if(options && !isNaN(name_parts[name_parts.length - 1]) && options.label && options.title)
		{
			name_parts.pop();
			content_options = widget.getArrayMgr("sel_options").getEntry(name_parts.join('['));
			delete content_options["$row"];
		}

		// Select options tend to be defined once, at the top level, so try that
		if(!content_options || content_options.length == 0)
		{
			content_options = widget.getArrayMgr("sel_options").getRoot().getEntry(name_parts[name_parts.length - 1]);
		}

		// Try in correct namespace (inside a grid or something)
		if(!content_options || content_options.length == 0)
		{
			content_options = widget.getArrayMgr("sel_options").getEntry(name_parts[name_parts.length - 1]);
		}

		// Try name like widget[$row]
		if(name_parts.length > 1 && (!content_options || content_options.length == 0))
		{
			let pop_that = JSON.parse(JSON.stringify(name_parts));
			while(pop_that.length > 1 && (!content_options || content_options.length == 0))
			{
				let last = pop_that.pop();
				content_options = widget.getArrayMgr('sel_options').getEntry(pop_that.join('['));

				// Double check, might have found a normal parent namespace ( eg subgrid in subgrid[selectbox] )
				// with an empty entry for the selectbox.  If there were valid options here,
				// we would have found them already, and keeping this would result in the ID as an option
				if(content_options && !Array.isArray(content_options) && typeof content_options[last] != 'undefined' && content_options[last])
				{
					content_options = content_options[last];
				}
				else if(content_options)
				{
					// Check for real values
					for(let key in content_options)
					{
						if(!(isNaN(<number><unknown>key) && typeof content_options[key] === 'string' ||
							!isNaN(<number><unknown>key) && typeof content_options[key] === 'object' && typeof content_options[key]['value'] !== 'undefined'))
						{
							// Found a parent of some other namespace
							content_options = undefined;
							break;
						}
					}
				}
			}
		}

		// Maybe in a row, and options got stuck in ${row} instead of top level
		// not sure this code is still needed, as server-side no longer creates ${row} or {$row} for select-options
		let row_stuck = ['${row}', '{$row}'];
		for(let i = 0; i < row_stuck.length && (!content_options || content_options.length == 0); i++)
		{
			// perspectiveData.row in nm, data["${row}"] in an auto-repeat grid
			if(widget.getArrayMgr("sel_options").perspectiveData.row || widget.getArrayMgr("sel_options").data[row_stuck[i]])
			{
				var row_id = widget.id.replace(/[0-9]+/, row_stuck[i]);
				content_options = widget.getArrayMgr("sel_options").getEntry(row_id);
				if(!content_options || content_options.length == 0)
				{
					content_options = widget.getArrayMgr("sel_options").getEntry(row_stuck[i] + '[' + widget.id + ']');
				}
			}
		}
		if(attr_options && Object.keys(attr_options).length > 0 && content_options)
		{
			//content_options = jQuery.extend(true, {}, attr_options, content_options);
			content_options = [...attr_options, ...content_options];
		}
	}

	// Check whether the options entry was found, if not read it from the
	// content array.
	if(content_options && content_options.length > 0 && widget.getArrayMgr('content') != null)
	{
		if(content_options)
		{
			attr_options = content_options;
		}
		let content_mgr = widget.getArrayMgr('content');
		if(content_mgr)
		{
			// If that didn't work, check according to ID
			if(!content_options)
			{
				content_options = content_mgr.getEntry("options-" + widget.id);
			}
			// Again, try last name part at top level
			if(!content_options)
			{
				content_options = content_mgr.getRoot().getEntry("options-" + name_parts[name_parts.length - 1]);
			}
		}
	}

	// Default to an empty object
	if(content_options == null)
	{
		content_options = [];
	}

	// Include type options, preferring any content options
	if(type_options.length || Object.keys(type_options).length > 0)
	{
		for(let i in content_options)
		{
			let value = typeof content_options[i] == 'object' && typeof content_options[i].value !== 'undefined' ? content_options[i].value : i;
			let added = false;

			// Override any existing
			for(let j in type_options)
			{
				if('' + type_options[j].value === '' + value)
				{
					added = true;
					type_options[j] = content_options[i];
					break;
				}
			}
			if(!added)
			{
				type_options.splice(parseInt(i), 0, content_options[i]);
			}
		}
		content_options = type_options;
	}
	return content_options;
}

// @ts-ignore TypeScript is not recognizing that this widget is a LitElement
customElements.define("et2-select", Et2Select);