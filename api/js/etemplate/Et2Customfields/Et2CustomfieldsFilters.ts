import {Et2CustomfieldsBase} from "./Et2CustomfieldsBase";
import {customElement} from "lit/decorators/custom-element.js";
import {css, html} from "lit";
import {html as staticHtml, unsafeStatic} from "lit/static-html.js";
import {repeat} from "lit/directives/repeat.js";
import {ref} from "lit/directives/ref.js";
import {CUSTOMFIELD_PREFIX} from "./Et2CustomfieldsBase";
import {
	applyCustomfieldWidgetMapping,
	mapCustomfieldToWidget
} from "./Et2CustomfieldWidgetMapper";
import type {Et2CustomfieldWidgetMapping} from "./Et2CustomfieldWidgetMapper";
import "../Et2Link/Et2LinkEntry";
import "../Et2Date/Et2DateRange";

/**
 * @summary Renders customfield filter widgets.
 *
 * Every filterable customfield renders, regardless of edit-dialog tab placement:
 * selects and app-backed fields as multi-selects, checkboxes as Yes/No selects,
 * the rest with their edit widget. Only types that cannot filter are skipped
 * (filemanager, button, passwd, htmlarea, serial).
 *
 * @csspart base - Container around all customfield filter controls.
 * @csspart field - Container for one rendered customfield filter.
 */
@customElement("et2-customfields-filters")
export class Et2CustomfieldsFilters extends Et2CustomfieldsBase
{
	static get styles()
	{
		return [
			...super.styles,
			css`
				:host {
					display: block;
				}

				.customfields-filters {
					display: flex;
					flex-direction: column;
					gap: var(--sl-spacing-x-small, 0.5rem);
				}

				.customfields-filters__field {
					min-width: 0;
					display: flex;
					flex-direction: column;
					align-items: stretch;
					gap: 2px;
				}

				.customfields-filters__label {
					line-height: 1.3;
				}

				.customfields-filters__field > *:not(label) {
					min-width: 0;
					width: 100%;
				}

				.customfields-filters__range {
					display: flex;
					gap: var(--sl-spacing-2x-small, 0.25rem);
				}

				.customfields-filters__range > * {
					flex: 1 1 50%;
					min-width: 0;
				}
			`
		];
	}

	protected createRenderRoot()
	{
		return this;
	}

	/**
	 * A customfield living on an edit-dialog tab is still filterable -
	 * legacy customfields-filters showed every field regardless of tab.
	 */
	protected get ignoreTabVisibility() : boolean
	{
		return true;
	}

	private _dirtySnapshot : string | null = null;

	/**
	 * Collect current filter values from the rendered field widgets.
	 *
	 * The mapper-created child widgets are not part of the etemplate widget
	 * tree, so etemplate2.getValues() cannot reach them - this widget answers
	 * for them instead (getValue/isDirty/resetDirty/isValid make it count as
	 * et2_IInput).
	 */
	getValue() : Record<string, any>
	{
		const result : Record<string, any> = {};
		const widgetValue = (widget : any) => (typeof widget?.getValue === "function" ? widget.getValue() : widget?.value) ?? "";
		for(const wrapper of Array.from(this.querySelectorAll("[data-field]")))
		{
			const fieldName = wrapper.getAttribute("data-field");
			const widget = wrapper.querySelector(":scope > :not(label)") as any;
			if(!fieldName || !widget)
			{
				continue;
			}
			if(widget.classList?.contains("customfields-filters__range"))
			{
				// from/to widget pair, see _rangeWidgetTemplate()
				const from = widgetValue(widget.querySelector("[data-range='from']"));
				const to = widgetValue(widget.querySelector("[data-range='to']"));
				result[CUSTOMFIELD_PREFIX + fieldName] = from !== "" || to !== "" ? {from, to} : "";
				continue;
			}
			// null (e.g. an empty date-range) crashes downstream Object.values() consumers
			result[CUSTOMFIELD_PREFIX + fieldName] = widgetValue(widget);
		}
		return result;
	}

	isDirty() : boolean
	{
		return this._dirtySnapshot !== JSON.stringify(this.getValue());
	}

	resetDirty()
	{
		this._dirtySnapshot = JSON.stringify(this.getValue());
	}

	isValid() : boolean
	{
		return true;
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
		const mapping = mapCustomfieldToWidget(fieldName, field, value, {
			context: "filters",
			readonly: false,
			apps: this._apps(),
			prefix: CUSTOMFIELD_PREFIX
		});
		if(mapping)
		{
			// the label renders on its own line above the widget, see render()
			delete mapping.attrs.label;
		}
		return mapping;
	}

	private _fieldWidgetTemplate(mapping : Et2CustomfieldWidgetMapping)
	{
		if(!mapping)
		{
			return html``;
		}
		if(mapping.range)
		{
			return this._rangeWidgetTemplate(mapping);
		}
		const tag = unsafeStatic(mapping.tagName);
		return staticHtml`
			<${tag}
				${ref((element) => applyCustomfieldWidgetMapping(element, mapping))}
			></${tag}>
		`;
	}

	/**
	 * A from/to pair of the mapped widget, e.g. float filters - value is {from, to}
	 */
	private _rangeWidgetTemplate(mapping : Et2CustomfieldWidgetMapping)
	{
		const tag = unsafeStatic(mapping.tagName);
		const value = mapping.attrs.value && typeof mapping.attrs.value === "object" ? mapping.attrs.value : {};
		const applySide = (element : any, side : "from" | "to") =>
		{
			if(!element)
			{
				return;
			}
			applyCustomfieldWidgetMapping(element, {
				tagName: mapping.tagName,
				attrs: {
					...mapping.attrs,
					id: (mapping.attrs.id || "") + "[" + side + "]",
					value: value[side] ?? ""
				}
			});
			// translate through the child widget's egw, like Et2DateRange does -
			// the app-scoped egw of this widget may miss the api phrases
			element.placeholder = element.egw?.()?.lang?.(side === "from" ? "From" : "To") || side;
		};
		return staticHtml`
			<div class="customfields-filters__range">
				<${tag} data-range="from"
					${ref((element) => applySide(element, "from"))}
				></${tag}>
				<${tag} data-range="to"
					${ref((element) => applySide(element, "to"))}
				></${tag}>
			</div>
		`;
	}

	private _lightDomStylesTemplate()
	{
		return html`
			<style>
				et2-customfields-filters {
					display: block;
				}

				et2-customfields-filters .customfields-filters {
					display: flex;
					flex-direction: column;
					gap: var(--sl-spacing-x-small, 0.5rem);
				}

				et2-customfields-filters .customfields-filters__field {
					min-width: 0;
					display: flex;
					flex-direction: column;
					align-items: stretch;
					gap: 2px;
				}

				et2-customfields-filters .customfields-filters__label {
					line-height: 1.3;
				}

				et2-customfields-filters .customfields-filters__field > *:not(label) {
					min-width: 0;
					width: 100%;
				}

				et2-customfields-filters .customfields-filters__range {
					display: flex;
					gap: var(--sl-spacing-2x-small, 0.25rem);
				}

				et2-customfields-filters .customfields-filters__range > * {
					flex: 1 1 50%;
					min-width: 0;
				}
			</style>
		`;
	}

	render()
	{
		const fields = this.getVisibleFieldNames();
		return html`
			${this._lightDomStylesTemplate()}
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
							<label class="customfields-filters__label" part="label">${field.label || fieldName}</label>
							${this._fieldWidgetTemplate(mapping)}
						</div>
					`;
				})}
			</div>
		`;
	}
}
