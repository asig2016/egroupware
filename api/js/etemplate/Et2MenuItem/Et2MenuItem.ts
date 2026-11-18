import {customElement} from "lit/decorators/custom-element.js";
import {SlMenuItem} from "@shoelace-style/shoelace";
import {Et2Widget} from "../Et2Widget/Et2Widget";
import {et2_IInput} from "../et2_core_interfaces";

import styles from "./Et2MenuItem.styles";
@customElement('et2-menu-item')
export class Et2MenuItem extends Et2Widget(SlMenuItem) implements et2_IInput
{
	static get styles(){
		return [
			super.styles,
			styles
		]
	}

	updated(changedProperties)
	{
		super.updated(changedProperties);
		this.keepSubmenuOnScreen();
	}

	/**
	 * Keep a submenu (eg. "Filter by" of a context menu) on the screen
	 *
	 * Shoelace places a submenu right of its entry and only flips it to the left, so on a phone, where
	 * the menu already takes most of the width, neither side fits and the submenu ran off the screen.
	 * When neither side has room it now goes below (or above) its entry, and a shift keeps it in the
	 * viewport: left or right of the entry a shift only moves it up or down, so desktops are unchanged.
	 *
	 * Checked after every update: Shoelace renders the popup only once its submenu controller is
	 * connected, not necessarily in the first render.  Attributes and properties Shoelace does not
	 * bind survive its re-renders.
	 */
	protected keepSubmenuOnScreen()
	{
		const popup = this.shadowRoot?.querySelector("sl-popup") as (HTMLElement & {
			placement : string,
			shift : boolean,
			shiftPadding : number
		}) | null;
		if(popup && !popup.shift)
		{
			// the other side of the entry first (right-to-left Shoelace places it left)
			const otherSide = popup.placement?.startsWith("left") ? "right-start" : "left-start";
			popup.setAttribute("flip-fallback-placements", otherSide + " bottom-end bottom-start top-end top-start");
			popup.shift = true;
			popup.shiftPadding = 8;
		}
	}

	getValue()
	{
		return this.value;
	}

	isDirty()
	{
		return false;
	}

	resetDirty() {}

	isValid() {return true;}
}