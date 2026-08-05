import {CUSTOMFIELD_PREFIX, Et2CustomfieldsBase, lightDomStylesTemplate} from "./Et2CustomfieldsBase";
import {customElement} from "lit/decorators/custom-element.js";
import {html} from "lit";
import {html as staticHtml, unsafeStatic} from "lit/static-html.js";
import {repeat} from "lit/directives/repeat.js";
import {ref} from "lit/directives/ref.js";
import {
	applyCustomfieldWidgetMapping,
	mapCustomfieldToWidget
} from "./Et2CustomfieldWidgetMapper";
import type {Et2CustomfieldWidgetMapping} from "./Et2CustomfieldWidgetMapper";
// The generated controls are created by tag name, so the ones a filter can map to must be defined
import "../Et2Link/Et2LinkEntry";
import "../Et2Date/Et2DateRange";
// float filters render as an et2-number from/to pair - without the definition the mapper falls back to et2-description
import "../Et2Textbox/Et2Number";

import styles from "./Et2CustomfieldsFilters.styles";
/**
 * @summary Renders customfield filter controls.
 *
 * Every customfield a filter can express a value for renders: select-style and app-backed
 * fields as multi-selects, a checkbox as a Yes/No select, a date and a float as a from/to range,
 * and the rest (text, int, url, ...) with their edit widget.  Only types with nothing to filter
 * on - filemanager, button, passwd, htmlarea, serial and captions - are skipped.
 *
 * @csspart base - Container around all customfield filter controls.
 * @csspart field - Container for one rendered customfield filter.
 */
/**
 * A from/to pair of generated controls answering as one filter, see _rangeWidgetTemplate().
 *
 * It sits in the widgets map like a single control, so the et2_IInput methods below treat it the
 * same way: the value is `{from, to}`, or "" when neither side is set so nothing filters.
 */
class Et2CustomfieldsRangeFilter
{
	from? : any;
	to? : any;

	private _sides() : any[]
	{
		return [this.from, this.to].filter(Boolean);
	}

	getValue() : {from : any, to : any} | ""
	{
		const valueOf = (widget : any) => (typeof widget?.getValue === "function" ? widget.getValue() : widget?.value) ?? "";
		const from = valueOf(this.from);
		const to = valueOf(this.to);
		return from !== "" || to !== "" ? {from, to} : "";
	}

	isDirty() : boolean
	{
		return this._sides().some((widget) => typeof widget.isDirty === "function" && widget.isDirty());
	}

	resetDirty() : void
	{
		this._sides().forEach((widget) => widget.resetDirty?.());
	}

	isValid(messages : string[]) : boolean
	{
		return this._sides().every((widget) => typeof widget.isValid !== "function" || widget.isValid(messages));
	}
}

@customElement("et2-customfields-filters")
export class Et2CustomfieldsFilters extends Et2CustomfieldsBase
{
	/**
	 * Field widgets are intentionally rendered into light DOM so legacy widget lookup,
	 * validation, and event paths can see the generated child widgets.  That also means Lit
	 * never adopts `static styles`, so our CSS is rendered as a <style> of our own.
	 */
	protected createRenderRoot()
	{
		return this;
	}

	/**
	 * A filter box has no tabs, so a customfield's tab must not decide whether it can be
	 * filtered on.  Which entries a filter selects has nothing to do with which tab of the edit
	 * dialog shows the field.
	 */
	protected get honoursTabs() : boolean
	{
		return false;
	}

	private _fieldValue(fieldName : string)
	{
		return this.value?.[CUSTOMFIELD_PREFIX + fieldName] ?? this.value?.[fieldName] ?? "";
	}

	private _apps()
	{
		try
		{
			return this.egw?.()?.link_app_list?.() || {};
		}
		catch(e)
		{
			return {};
		}
	}

	private _fieldWidgetMapping(fieldName : string, field : Record<string, any>, value : any) : Et2CustomfieldWidgetMapping | null
	{
		return mapCustomfieldToWidget(fieldName, field, value, {
			context: "filters",
			readonly: false,
			apps: this._apps(),
			prefix: CUSTOMFIELD_PREFIX
		});
	}

	/** The generated filter controls, by unprefixed customfield name. */
	protected widgets : Record<string, any> = {};

	/** Filters already given their starting value, so a re-render does not undo the user's choice. */
	private _valued : WeakSet<Element> = new WeakSet();

	private _fieldWidgetTemplate(fieldName : string, mapping : Et2CustomfieldWidgetMapping)
	{
		if(!mapping)
		{
			return html``;
		}
		if(mapping.range)
		{
			return this._rangeWidgetTemplate(fieldName, mapping);
		}
		const tag = unsafeStatic(mapping.tagName);
		return staticHtml`
			<${tag}
				${ref((element) => this._adoptFilterWidget(fieldName, element, mapping))}
			></${tag}>
		`;
	}

	/**
	 * Keep hold of a generated filter so we can report what it is set to.
	 *
	 * @param {string} fieldName Unprefixed customfield name.
	 * @param {Element} element The generated control, or undefined when it was removed.
	 * @param {Et2CustomfieldWidgetMapping} mapping Tag and attributes for it.
	 */
	private _adoptFilterWidget(fieldName : string, element : Element | undefined, mapping : Et2CustomfieldWidgetMapping)
	{
		if(!element)
		{
			delete this.widgets[fieldName];
			return;
		}
		// Only the parent link, not addChild(): that would put the control in the widget tree, where
		// it would be reported a second time under an id of its own.
		(<any>element)._parent = this;
		const attrs = {...mapping.attrs};
		if(this._valued.has(element))
		{
			// Already placed, so by now it holds whatever the user filtered by - handing it the
			// value we started with would throw that away.  Lit gives ref() a fresh callback each
			// render, so this is tracked per element rather than per name.
			delete attrs.value;
		}
		this._valued.add(element);
		applyCustomfieldWidgetMapping(element, {tagName: mapping.tagName, attrs});
		this.widgets[fieldName] = element;
	}

	/**
	 * A from/to pair of the mapped widget, e.g. float filters - value is {from, to}.
	 *
	 * The field's label goes on the from side only, where it lines up with the other filters; the
	 * stylesheet widens that side by the label column so the two inputs still come out equal.
	 */
	private _rangeWidgetTemplate(fieldName : string, mapping : Et2CustomfieldWidgetMapping)
	{
		const tag = unsafeStatic(mapping.tagName);
		return staticHtml`
			<div class="customfields-filters__range">
				<${tag} data-range="from"
					${ref((element) => this._adoptRangeSide(fieldName, element, mapping, "from"))}
				></${tag}>
				<${tag} data-range="to"
					${ref((element) => this._adoptRangeSide(fieldName, element, mapping, "to"))}
				></${tag}>
			</div>
		`;
	}

	/**
	 * Keep hold of one side of a generated from/to pair, see _adoptFilterWidget() for the rest.
	 *
	 * @param {string} fieldName Unprefixed customfield name.
	 * @param {Element} element The generated control, or undefined when it was removed.
	 * @param {Et2CustomfieldWidgetMapping} mapping Tag and attributes for the pair.
	 * @param {"from"|"to"} side Which bound this control is.
	 */
	private _adoptRangeSide(fieldName : string, element : Element | undefined, mapping : Et2CustomfieldWidgetMapping, side : "from" | "to")
	{
		const range : Et2CustomfieldsRangeFilter = this.widgets[fieldName] instanceof Et2CustomfieldsRangeFilter
			? this.widgets[fieldName] : new Et2CustomfieldsRangeFilter();
		if(!element)
		{
			delete range[side];
			if(!range.from && !range.to)
			{
				delete this.widgets[fieldName];
			}
			return;
		}
		(<any>element)._parent = this;
		const value = mapping.attrs.value && typeof mapping.attrs.value === "object" ? mapping.attrs.value : {};
		const attrs : Record<string, any> = {
			...mapping.attrs,
			id: (mapping.attrs.id || "") + "[" + side + "]",
			value: value[side] ?? ""
		};
		if(side === "to")
		{
			delete attrs.label;
		}
		if(this._valued.has(element))
		{
			delete attrs.value;
		}
		this._valued.add(element);
		applyCustomfieldWidgetMapping(element, {tagName: mapping.tagName, attrs});
		// translate through the child widget's egw, like Et2DateRange does -
		// the app-scoped egw of this widget may miss the api phrases
		(<any>element).placeholder = (<any>element).egw?.()?.lang?.(side === "from" ? "From" : "To") || side;
		range[side] = element;
		this.widgets[fieldName] = range;
	}

	/**
	 * et2_IInput: what the customfield filters are set to, keyed as the nextmatch expects.
	 *
	 * A nextmatch takes its customfield filters as one `col_filter` map of `{"#name": value}`, and
	 * this widget is given that id - so the whole set is reported here.  The generated controls are
	 * deliberately outside the widget tree, so without this nothing would ask them and filtering
	 * would quietly stop working.
	 */
	getValue() : Record<string, any>
	{
		const value = {};
		for(const [fieldName, widget] of Object.entries(this.widgets))
		{
			if(typeof widget?.getValue === "function")
			{
				// null (e.g. an empty date-range) crashes downstream Object.values() consumers,
				// such as the kdots filter indicator - report an empty filter as ""
				value[CUSTOMFIELD_PREFIX + fieldName] = widget.getValue() ?? "";
			}
		}
		return value;
	}

	/**
	 * et2_IInput: true once any filter has been changed.
	 */
	isDirty() : boolean
	{
		return Object.values(this.widgets).some((widget) => typeof widget?.isDirty === "function" && widget.isDirty());
	}

	/**
	 * et2_IInput: take the current filters as the unchanged ones.
	 */
	resetDirty() : void
	{
		Object.values(this.widgets).forEach((widget) => widget?.resetDirty?.());
	}

	/**
	 * et2_IInput: a filter has nothing to validate, but the interface is only recognised when all
	 * four methods are there.
	 */
	isValid(messages : string[]) : boolean
	{
		return Object.values(this.widgets).every(
			(widget) => typeof widget?.isValid !== "function" || widget.isValid(messages)
		);
	}

	render()
	{
		const fields = this.getVisibleFieldNames();
		return html`
			${lightDomStylesTemplate(styles)}
			<div class="customfields-filters" part="base">
				${repeat(fields, (fieldName) => fieldName, (fieldName) =>
				{
					const field = this.customfields?.[fieldName] || {};
					const value = this._fieldValue(fieldName);
					const mapping = this._fieldWidgetMapping(fieldName, field, value);
					if(!mapping)
					{
						return html``;
					}
					return html`
						<div class="customfields-filters__field" data-field=${fieldName} part="field">
							${this._fieldWidgetTemplate(fieldName, mapping)}
						</div>
					`;
				})}
			</div>
		`;
	}
}
