/**
 * EGroupware eTemplate2 - Readonly duration WebComponent
 *
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 * @package api
 * @link https://www.egroupware.org
 * @author Nathan Gray
 */


import {css, html} from "lit";
import {Et2DateDuration, formatOptions} from "./Et2DateDuration";
import {dateStyles} from "./DateStyles";
import {customElement} from "lit/decorators/custom-element.js";


/**
 * This is a stripped-down read-only widget used in nextmatch
 *
 * @slot prefix - Used to prepend a presentational icon or similar element to the widget.
 * @slot suffix - Like prefix, but after
 */
@customElement("et2-date-duration_ro")
export class Et2DateDurationReadonly extends Et2DateDuration
{
	static get styles()
	{
		return [
			...super.styles,
			...dateStyles,
			css`
			:host {
			border: none;
			min-width: 2em;
			}
			`
		];
	}

	constructor()
	{
		super();

		// Property defaults
		this.selectUnit = false;	// otherwise just best matching unit will be used for eg. display_format "h:m:s"
	}

	get value()
	{
		return this.__value;
	}

	set value(_value)
	{
		const old_value = this.__value;
		this.__value = _value;
		this.requestUpdate("value", old_value);
	}

	get innerText() : string
	{
		return this.shadowRoot.querySelector('span').innerText;
	}

	render()
	{
		let parsed = this.__value;

		const format_options = <formatOptions>{
			selectUnit: this.selectUnit,
			displayFormat: this.displayFormat,
			dataFormat: this.dataFormat,
			numberFormat: this.egw().preference("number_format"),
			hoursPerDay: this.hoursPerDay,
			emptyNot0: this.emptyNot0
		};

		const display = this.formatter(parsed, format_options);
		return html`
            <slot name="prefix"></slot>
            <span ${this.id ? html`id="${this._dom_id}"` : ''}>
                  ${display.value}${display.unit}
            </span>
            <slot name="suffix"></slot>
		`;
	}

	/**
	 * These are the attributes we allow to change for each row
	 *
	 * @param attrs
	 */
	getDetachedAttributes(attrs)
	{
		attrs.push("id", "value", "class", "disabled");
	}

	getDetachedNodes() : HTMLElement[]
	{
		return [<HTMLElement><unknown>this];
	}

	setDetachedAttributes(_nodes : HTMLElement[], _values : object, _data? : any) : void
	{
		for(let attr in _values)
		{
			this[attr] = _values[attr];
		}
	}
}