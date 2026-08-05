/**
 * Behaviour under test: the "hidden" attribute/property of Et2Widget actually takes a widget off
 * the screen, and a boolean widget attribute set to false does not linger in the DOM.
 *
 * Setup: a plain et2-box (Et2Widget over LitElement, so it gets Et2Widget's base styles and none of
 * Shoelace's) is created with @open-wc fixture, then hidden either via the property or via
 * transformAttributes(), which is the path template attributes and nextmatch row hydration take.
 *
 * Pass criteria:
 * - hidden === true  -> computed display is "none" (Et2Widget's :host([hidden]) rule wins over the
 *   ":host{display:...}" every widget sets, which the UA's [hidden] rule does not).
 * - hidden === false -> no "hidden" attribute left in the DOM at all. "hidden" is a boolean
 *   attribute, so hidden="false" would still read as hidden.
 *
 * Environment: needs a real browser (computed styles + shadow DOM), it runs under web-test-runner.
 */
import {assert, elementUpdated, fixture, html} from '@open-wc/testing';
import {Et2Box} from "../../Layout/Et2Box/Et2Box";

describe("Et2Widget hidden", () =>
{
	let element : Et2Box;

	beforeEach(async() =>
	{
		element = await fixture<Et2Box>(html`
            <et2-box></et2-box>
		`);
	});

	it('is an upgraded Et2Widget', () =>
	{
		// also keeps the import a value import - a type-only one is stripped, the tag never gets
		// defined and every assertion below would run against a plain HTMLElement instead
		assert.instanceOf(element, Et2Box);
	});

	it('is visible by default', () =>
	{
		assert.notEqual(window.getComputedStyle(element).display, "none");
	});

	it('is not displayed when hidden', async() =>
	{
		element.hidden = true;
		await elementUpdated(element);

		assert.equal(window.getComputedStyle(element).display, "none", "hidden widget was still displayed");
	});

	it('is displayed again when un-hidden', async() =>
	{
		element.hidden = true;
		await elementUpdated(element);
		element.hidden = false;
		await elementUpdated(element);

		assert.notEqual(window.getComputedStyle(element).display, "none");
	});

	it('drops the attribute when a boolean attribute is set to false', async() =>
	{
		// as a template / nextmatch row would: attribute present, then transformed for this row
		element.setAttribute("hidden", "");
		element.transformAttributes({hidden: false});
		await elementUpdated(element);

		assert.isFalse(element.hasAttribute("hidden"), 'hidden="false" still reads as hidden');
		assert.notEqual(window.getComputedStyle(element).display, "none");
	});

	it('sets the attribute when a boolean attribute is set to true', async() =>
	{
		element.transformAttributes({hidden: true});
		await elementUpdated(element);

		assert.isTrue(element.hasAttribute("hidden"));
		assert.equal(window.getComputedStyle(element).display, "none");
	});
});
