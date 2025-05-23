/**
 * Use a custom tag for when multiple=true
 *
 * @returns {string}
 */
import {html, literal, StaticValue} from "lit/static-html.js";
import {property} from "lit/decorators/property.js";
import {until} from "lit/directives/until.js";
import {css, nothing, PropertyValues, TemplateResult, unsafeCSS} from "lit";
import {Et2TreeDropdown} from "../../Et2Tree/Et2TreeDropdown";
import {Et2CategoryTag} from "../Tag/Et2CategoryTag";
import {Et2StaticSelectMixin, StaticOptions as so} from "../StaticOptions";

/**
 * @since 23.1.x
 * This is not a classical Select box but a structured tree
 */
export class Et2SelectCategory extends Et2StaticSelectMixin(Et2TreeDropdown)
{

	static get styles()
	{
		return [
			...super.styles,
			css`
				:host {
					--category-color: transparent;
				}

				/* Color on tree items */
				::part(item-item) {
					border-inline-start: 4px solid transparent;
					border-inline-start-color: var(--category-color, transparent);
				}

				/* Color on tags */
				:host(:not([multiple])) .tree_tag::part(base) {
					border-inline-start: 4px solid transparent;
					border-inline-start-color: var(--category-color, transparent);
				}

				/* Color on single value */

				:host(:not([multiple])) .tree-dropdown:not(.tree-dropdown--has-value) .tree-dropdown__combobox {
					padding-inline-start: 3px;
				}

				:host(:not([multiple])) .tree-dropdown--has-value .tree-dropdown__combobox {
					border-inline-start: 4px solid;
					border-inline-start-color: var(--category-color, var(--sl-input-border-color));
				}
			`
		];
	}
	/**
	 * Application to get categories from
	 */
	@property({type: String}) application = '';

	/**
	 * Include global categories
	 */
	@property({type: Boolean}) globalCategories = true;

	/**
	 * Show categories below this parent category
	 */
	@property({type: Number}) parentCat: { type: Number }



	private keep_import : Et2CategoryTag

	constructor()
	{
		super();
		// we should not translate categories name
		this.noLang = true;
	}

	connectedCallback()
	{
		super.connectedCallback();

		// Default the application if not set
		if(!this.application && this.getInstanceManager())
		{
			this.application = this.getInstanceManager().app;
		}

		// Set the search options from our properties
		this.searchOptions.application = this.application;
		this.searchOptions.globalCategories = this.globalCategories;

		this.fetchComplete = so.cat(this).then(options => {
			this._static_options = options;
			this.requestUpdate("select_options");
		});
	}

	disconnectedCallback()
	{
		super.disconnectedCallback();
		const box = this.shadowRoot?.querySelector('.tree-dropdown__combobox');
		if(box)
		{
			this.egw().tooltipUnbind(box);
		}
	}

	bindTooltip()
	{
		//overide so tooltip wont be bound
		this.updateComplete.then(() => {
			const box = this.shadowRoot?.querySelector('.tree-dropdown__combobox');
			if(box){
				this.egw().tooltipBind(box, this.egw().lang(this.statustext))
			}
		})
	}

	willUpdate(changedProperties : PropertyValues)
	{
		super.willUpdate(changedProperties);

		if (changedProperties.has("globalCategories") ||
			changedProperties.has("application") || changedProperties.has("parentCat"))
		{
			this.fetchComplete = so.cat(this).then(options => {
				this._static_options = options;
				this.requestUpdate("select_options");
			});
		}

		if(changedProperties.has('application'))
		{
			this.searchOptions.application = this.application;
		}
		if(changedProperties.has('globalCategories'))
		{
			this.searchOptions.globalCategories = this.globalCategories;
		}
	}

	public get tagTag() : StaticValue
	{
		return literal`et2-category-tag`;
	}

	/**
	 * Set CSS category colors
	 * @returns {TemplateResult}
	 * @protected
	 */
	protected styleTemplate()
	{
		let css = "";
		const catColor = (option) =>
		{
			css += ".cat_" + option.value + " {--category-color: var(--cat-" + option.value + "-color ,transparent);}\n";

			if (typeof option.children === 'object')
			{
				option.children?.forEach((option) => catColor(option))
			}
		}
		this.select_options.forEach((option => catColor(option)));
		// @formatter:off
		return html`
            <style>${unsafeCSS(css)}</style>
		`;
		// @formatter:on
	}

	protected handleValueChange(e)
	{
		super.handleValueChange(e);

		// Just re-draw to get the colors & icon
		this.requestUpdate();
	}

	render()
	{
		let style : Promise<TemplateResult> | symbol = nothing;
		if(this.value && !this.multiple)
		{
			style = this.fetchComplete.then(() =>
			{
				const option = this.optionSearch(this.value, this.select_options, 'value', 'children');
				if(option)
				{
					const css = ".tree-dropdown--has-value .tree-dropdown__combobox {" +
						"--category-color: var(--cat-" + option.value + "-color ,var(--sl-input-border-color));" +
						"}\n";
					return html`
                        <style>${unsafeCSS(css)}</style>`;
				}
			});
		}
		return html`
            ${until(style, nothing)}
            ${super.render()}
		`;
	}
}

// @ts-ignore Type problems because of Et2WidgetWithSelectMixin in parent
customElements.define("et2-select-cat", Et2SelectCategory);