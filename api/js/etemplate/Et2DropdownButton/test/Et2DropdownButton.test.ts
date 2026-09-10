import {assert, fixture, html, oneEvent} from '@open-wc/testing';
import {Et2DropdownButton} from "../Et2DropdownButton";
import {egwStub} from "../../Et2Select/test/helpers";
// the widget only pulls in the button group and the dropdown; the menu items it stamps are
// registered by the full bundle at runtime - here they have to be imported, or `item.value`
// is undefined on an un-upgraded element
import {SlMenuItem} from "@shoelace-style/shoelace";

let keepMenuItem : typeof SlMenuItem = SlMenuItem;

/**
 * Contract under test
 *
 * The dropdown button renders its menu items the first time the dropdown opens, not with the
 * button itself. Every sl-menu-item render reads getComputedStyle().direction, which forces a
 * style recalculation of the whole document while the DOM is dirty; a pane that is rebuilt per
 * selection with two of these buttons paid ~8 ms per option, 200 ms per arrow key in the mail
 * archive list (2026-09-10). Nobody can see the menu before it opens.
 *
 * 1. Freshly rendered with options, the menu holds no items.
 * 2. Once the dropdown shows, every option is an item, and stays so on later renders.
 * 3. Picking an item still fires change with its value.
 */

// @ts-ignore
window.egw = {...egwStub};

const OPTIONS = [
	{value: "a", label: "Alpha"},
	{value: "b", label: "Beta"},
	{value: "c", label: "Gamma"}
];

async function makeButton() : Promise<Et2DropdownButton>
{
	await customElements.whenDefined("sl-menu-item");
	const element = <Et2DropdownButton>await fixture(html`
        <et2-dropdown-button label="Pick"></et2-dropdown-button>`);
	assert.instanceOf(element, Et2DropdownButton, "et2-dropdown-button did not upgrade");
	element.select_options = OPTIONS;
	await element.updateComplete;
	return element;
}

const menuItems = (element : Et2DropdownButton) => element.shadowRoot.querySelectorAll("sl-menu sl-menu-item");

describe("Et2DropdownButton renders its menu lazily", () =>
{
	it("stamps no menu items before the dropdown opened", async() =>
	{
		const element = await makeButton();

		assert.equal(menuItems(element).length, 0, "items rendered before anyone could see them");
		assert.equal(element.select_options.length, OPTIONS.length, "the options are still there");
	});

	it("renders every option once the dropdown shows, and keeps them", async() =>
	{
		const element = await makeButton();

		element.dropdownNode.dispatchEvent(new CustomEvent("sl-show", {bubbles: true, composed: true}));
		await element.updateComplete;
		assert.equal(menuItems(element).length, OPTIONS.length, "items after the first open");

		// a later re-render (new options) keeps rendering them
		element.select_options = [...OPTIONS, {value: "d", label: "Delta"}];
		await element.updateComplete;
		assert.equal(menuItems(element).length, OPTIONS.length + 1, "items after a later option change");
	});

	it("still reports the picked value through change", async() =>
	{
		const element = await makeButton();
		element.dropdownNode.dispatchEvent(new CustomEvent("sl-show", {bubbles: true, composed: true}));
		await element.updateComplete;

		const item = <HTMLElement>menuItems(element)[1];
		setTimeout(() => element.shadowRoot.querySelector("sl-menu").dispatchEvent(
			new CustomEvent("sl-select", {detail: {item}, bubbles: true, composed: true})));
		await oneEvent(element, "change");

		assert.equal(element.value, "b");
	});
});
