import {css, html, LitElement, nothing} from "lit";
import {customElement} from "lit/decorators/custom-element.js";
import {property} from "lit/decorators/property.js";
import {classMap} from "lit/directives/class-map.js";
import {live} from "lit/directives/live.js";
import {Et2InputWidget} from "../Et2InputWidget/Et2InputWidget";
import {SlSwitch} from "@shoelace-style/shoelace";

/**
 * @summary Switch to allow choosing between two options, displayed with two images
 *
 * @slot on - Content shown when the switch is on
 * @slot off - Content shown when the switch is off
 * @slot help-text - Text that describes how to use the switch. Alternatively, you can use the `help-text` attribute.
 *
 * @cssproperty --height - The height of the switch.
 * @cssproperty --width - The width of the switch.
 * @cssproperty --indicator-color - The color of the selected image
 */
@customElement("et2-switch-icon")
export class Et2SwitchIcon extends Et2InputWidget(LitElement)
{
	static get styles()
	{
		return [
			...super.styles,
			css`
				:host {
					--indicator-color: var(--sl-color-primary-600);
				}

				sl-switch {
					--sl-toggle-size-medium: 2em;
				}

				::part(control) {
					display: none;
				}

				::part(label) {
					width: 100%;
					height: 100%;
				}

				.label {
					display: inline-flex;
					flex: 1 1 auto;
					font-size: var(--height);
					user-select: none;
				}

				et2-image, ::slotted(:scope > *) {
					flex: 1 1 50%;
					font-size: var(--width);
				}

				slot {
					color: var(--sl-color-neutral-400);
				}

				sl-switch[checked] slot[name="on"], sl-switch:not([checked]) slot[name="off"] {
					color: var(--indicator-color, inherit);
				}

				.label:hover {
					background-color: var(--sl-color-primary-50);
					border-color: var(--sl-color-primary-300);
				}
			`
		]
	}

	/**
	 * Name of the icon displayed when the switch is on
	 * @type {string}
	 */
	@property() onIcon = "check";

	/**
	 * Name of the icon displayed when the switch is off
	 * @type {string}
	 */
	@property() offIcon = "x"

	private get switch() : SlSwitch { return <SlSwitch>this.shadowRoot?.querySelector("sl-switch")};

	private get input() { return this.switch.shadowRoot.querySelector("input");}

	async getUpdateComplete()
	{
		const result = await super.getUpdateComplete();
		await this.switch?.updateComplete;
		return result;
	}

	set value(new_value : string | boolean)
	{
		this.switch.checked = !!new_value;
	}

	get value()
	{
		return this.switch?.checked;
	}

	labelTemplate()
	{
		return html`
            ${this.label ? html`<span
                    part="form-control-label"
                    class="form-control__label">${this.label}
			</span>` : nothing}
            <span
                    class=${classMap({
                        "label": true,
                        "on": this.checked,
                    })}
                    aria-label="${this.label}"
            >
				<slot name="on">
					<et2-image class="image on" src=${this.onIcon} title="${this.toggleOn}"></et2-image>
				</slot>
				<slot name="off">
					<et2-image class="image off" src=${this.offIcon} title="${this.toggleOff}"></et2-image>
				</slot>
			</span>
		`;
	}

	render()
	{
		return html`
            <sl-switch
                    .label=${this.label}
                    .value=${live(this.value)}
                    .checked=${live(this.checked)}
                    .disabled=${live(this.disabled)}
                    .required=${this.required}
                    .helpText=${this.helpText}
            >
                ${this.labelTemplate()}
            </sl-switch>
		`;
	}
}