/**
 * Test file for Etemplate webComponent Hidden input
 */
import {assert, elementUpdated, fixture, html} from '@open-wc/testing';
import {Et2Hidden} from "../Et2Hidden";
import * as sinon from "sinon";

// Stub global egw
// @ts-ignore
window.egw = {
	lang: i => i + "*",
	tooltipUnbind: () => {}
};

let element : Et2Hidden;

async function before()
{
	element = await fixture<Et2Hidden>(html`
        <et2-hidden value="/index.php?menuaction=app.class.method&ajax=true"></et2-hidden>
	`);
	sinon.stub(element, "egw").returns(window.egw);
	await elementUpdated(element);
	return element;
}

describe("Hidden widget", () =>
{
	beforeEach(before);

	it('is defined', () =>
	{
		assert.instanceOf(element, Et2Hidden);
	});

	it('returns its value', () =>
	{
		assert.equal(element.getValue(), "/index.php?menuaction=app.class.method&ajax=true");
	});

	// Regression: a template whose readonlys use `__ALL__` (eg. a user without edit
	// rights) marks every widget readonly, including hidden ones. The generic
	// Et2InputWidget answer for a readonly widget is null, which lost the server
	// provided ajax url that app-box tab loaders read from their hidden widget.
	it('still returns its value when readonly', async() =>
	{
		element.readonly = true;
		await elementUpdated(element);
		assert.equal(element.getValue(), "/index.php?menuaction=app.class.method&ajax=true");
	});

	it('returns null when disabled', async() =>
	{
		element.disabled = true;
		await elementUpdated(element);
		assert.isNull(element.getValue());
	});
});
