/**
 * Regression coverage for what `disabled` and `hidden` mean on an et2-menu-item.
 *
 * Behaviour under test: Et2Widget's base styles hide anything disabled
 * (`:host([disabled]) {display: none}`), because for most widgets "disabled" means "does not
 * exist as far as the user is concerned".  A menu item is the exception - Shoelace's
 * sl-menu-item[disabled] means "visible but not selectable", and EgwMenuShoelace relies on that
 * split: applyContext() sets `disabled` from an action's `enabled` and `hidden` from its
 * `visible`, so `EgwAction.hideOnDisabled = false` (the default) can keep an unavailable action
 * on screen, greyed out.  Et2MenuItem therefore has to undo the inherited rule; when it did not,
 * every action gated by `disableClass` silently disappeared from the context menu in every app.
 *
 * Setup: plain fixtures, no egw stub needed - this is pure CSS applied by the element's own
 * shadow-root stylesheet, so the attributes are set directly and the resolved style read back.
 *
 * Pass criteria:
 *  - disabled alone   -> laid out (display is NOT "none"), so it can be seen and greyed.
 *  - hidden alone     -> not laid out.
 *  - disabled+hidden  -> not laid out (hidden wins; it is the "gone" flag).
 * A failure here means a disabled action is invisible rather than greyed (or, in the reverse
 * direction, that a deliberately hidden item has started showing up).
 */
import {assert, fixture, html} from '@open-wc/testing';
import {Et2MenuItem} from "../Et2MenuItem";

describe("Menu item widget", () =>
{
	let element : Et2MenuItem;

	// `hidden` is a reflected Lit property with no initial value, so wait out the update that
	// writes the attribute before reading the resolved style.
	async function setFlags(disabled : boolean, hidden : boolean)
	{
		element.disabled = disabled;
		element.hidden = hidden;
		await element.updateComplete;
	}

	beforeEach(async() =>
	{
		element = await fixture<Et2MenuItem>(html`
            <et2-menu-item>I'm a menu item</et2-menu-item>
		`);
	});

	it('is defined', () =>
	{
		assert.instanceOf(element, Et2MenuItem);
	});

	it("stays laid out while disabled, so it can be shown greyed out", async() =>
	{
		await setFlags(true, false);

		assert.isTrue(element.hasAttribute("disabled"), "disabled did not reflect to an attribute");
		assert.notEqual(getComputedStyle(element).display, "none",
			"a disabled menu item must stay visible - being unavailable is what the menu is conveying");
	});

	it("is not laid out while hidden", async() =>
	{
		await setFlags(false, true);

		assert.equal(getComputedStyle(element).display, "none");
	});

	it("hidden wins over disabled when both are set", async() =>
	{
		await setFlags(true, true);

		assert.equal(getComputedStyle(element).display, "none");
	});

	it("is laid out again once both are cleared", async() =>
	{
		await setFlags(true, true);
		await setFlags(false, false);

		assert.notEqual(getComputedStyle(element).display, "none");
	});

	/**
	 * A submenu (eg. the context menu's "Filter by") ran off a phone's screen: Shoelace only flips
	 * it from right to left of its entry, and on a phone neither side has room.  The popup has to
	 * fall back to below/above its entry and shift into the viewport.
	 */
	it("lets a submenu fall back below or above its entry and shift into the screen", async() =>
	{
		element = await fixture<Et2MenuItem>(html`
            <et2-menu-item>Filter by
                <sl-menu slot="submenu">
                    <et2-menu-item>Sub item</et2-menu-item>
                </sl-menu>
            </et2-menu-item>
		`);
		await element.updateComplete;
		element.requestUpdate();
		await element.updateComplete;

		const popup = element.shadowRoot.querySelector("sl-popup") as any;
		assert.exists(popup, "a menu item with a submenu renders an sl-popup");
		assert.include(popup.getAttribute("flip-fallback-placements") ?? "", "bottom-start",
			"a submenu must be allowed below its entry when neither side has room");
		assert.isTrue(popup.shift, "a submenu must shift into the viewport");
	});

	it("opens a submenu inside the screen when the menu is as wide as the screen", async() =>
	{
		const menu = await fixture<HTMLElement>(html`
            <sl-menu style="width: 100vw; box-sizing: border-box">
                <et2-menu-item>Filter by
                    <sl-menu slot="submenu" style="width: 60vw">
                        <et2-menu-item>Sub item</et2-menu-item>
                    </sl-menu>
                </et2-menu-item>
            </sl-menu>
		`);
		const item = menu.querySelector("et2-menu-item") as Et2MenuItem;
		await item.updateComplete;
		item.requestUpdate();
		await item.updateComplete;
		const popup = item.shadowRoot.querySelector("sl-popup") as any;
		popup.active = true;
		await popup.updateComplete;
		await new Promise(r => setTimeout(r, 100));

		const rect = (item.querySelector("sl-menu[slot=submenu]") as HTMLElement).getBoundingClientRect();
		assert.isAtLeast(Math.round(rect.left), 0, "submenu ran off the left edge");
		assert.isAtMost(Math.round(rect.right), window.innerWidth, "submenu ran off the right edge");
	});
});
