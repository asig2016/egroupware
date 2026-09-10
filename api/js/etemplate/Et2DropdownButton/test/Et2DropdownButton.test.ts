/**
 * Test file for Etemplate webComponent Et2DropdownButton
 */
import {assert, elementUpdated, fixture, html, oneEvent} from '@open-wc/testing';
import {Et2DropdownButton} from "../Et2DropdownButton";
import {inputBasicTests} from "../../Et2InputWidget/test/InputBasicTests";
import * as sinon from "sinon";
// The rendered <sl-menu-item>/<sl-button>/<sl-dropdown>/<sl-button-group> never upgrade without
// these (same gotcha as sl-switch/sl-select/sl-menu-item elsewhere in this rollout)
import "@shoelace-style/shoelace/dist/components/menu-item/menu-item.js";
import "@shoelace-style/shoelace/dist/components/menu/menu.js";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/button-group/button-group.js";
import "@shoelace-style/shoelace/dist/components/dropdown/dropdown.js";

window.egwIsMobile = () => false;
// @ts-ignore
window.egw = {
	lang: i => i + "*",
	tooltipUnbind: () => {},
	preference: () => "",
	getAppName: () => "test"
};
// Reference to component under test
let element : Et2DropdownButton;

async function before()
{
	element = await fixture<Et2DropdownButton>(html`
        <et2-dropdown-button></et2-dropdown-button>
	`);

	sinon.stub(element, "egw").returns(window.egw);
	element.noLang = true;
	element.select_options = [{value: "one", label: "One"}, {value: "two", label: "Two"}];
	await elementUpdated(element);

	return element;
}

describe("Dropdown button widget", () =>
{
	// Setup run before each test
	beforeEach(before);

	it('is defined', () =>
	{
		assert.instanceOf(element, Et2DropdownButton);
	});

	it("renders nothing when readonly", async() =>
	{
		element.readonly = true;
		await elementUpdated(element);

		assert.notExists(element.shadowRoot.querySelector("sl-button-group"));
	});
});

// value is a plain string (this._value), not derived from rendered DOM state - a direct property,
// simple round trip. No label/help-text rendering exists at all (it's a button).
inputBasicTests(before, "one", "sl-menu-item", {
	skip: ["label", "help-text"],
	checkEmptyDisplay: () => {}
});

/**
 * Lazy menu rendering
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
const OPTIONS = [
	{value: "a", label: "Alpha"},
	{value: "b", label: "Beta"},
	{value: "c", label: "Gamma"}
];

async function makeButton() : Promise<Et2DropdownButton>
{
	await customElements.whenDefined("sl-menu-item");
	const button = <Et2DropdownButton>await fixture(html`
        <et2-dropdown-button label="Pick"></et2-dropdown-button>`);
	assert.instanceOf(button, Et2DropdownButton, "et2-dropdown-button did not upgrade");
	sinon.stub(button, "egw").returns(window.egw);
	button.noLang = true;
	button.select_options = OPTIONS;
	await button.updateComplete;
	return button;
}

const menuItems = (button : Et2DropdownButton) => button.shadowRoot.querySelectorAll("sl-menu sl-menu-item");

describe("Et2DropdownButton renders its menu lazily", () =>
{
	it("stamps no menu items before the dropdown opened", async() =>
	{
		const button = await makeButton();

		assert.equal(menuItems(button).length, 0, "items rendered before anyone could see them");
		assert.equal(button.select_options.length, OPTIONS.length, "the options are still there");
	});

	it("renders every option once the dropdown shows, and keeps them", async() =>
	{
		const button = await makeButton();

		button.dropdownNode.dispatchEvent(new CustomEvent("sl-show", {bubbles: true, composed: true}));
		await button.updateComplete;
		assert.equal(menuItems(button).length, OPTIONS.length, "items after the first open");

		// a later re-render (new options) keeps rendering them
		button.select_options = [...OPTIONS, {value: "d", label: "Delta"}];
		await button.updateComplete;
		assert.equal(menuItems(button).length, OPTIONS.length + 1, "items after a later option change");
	});

	it("still reports the picked value through change", async() =>
	{
		const button = await makeButton();
		button.dropdownNode.dispatchEvent(new CustomEvent("sl-show", {bubbles: true, composed: true}));
		await button.updateComplete;

		const item = <HTMLElement>menuItems(button)[1];
		setTimeout(() => button.shadowRoot.querySelector("sl-menu").dispatchEvent(
			new CustomEvent("sl-select", {detail: {item}, bubbles: true, composed: true})));
		await oneEvent(button, "change");

		assert.equal(button.value, "b");
	});
});
