/**
 * Contract: a selected value's tag shows the title of its option as tooltip, the same text the
 * option shows in the dropdown (translated unless noLang).
 *
 * _tagTemplate() is handed the <sl-option> element.  _optionTemplate() puts the option's title on
 * it only as aria-label, so the element's own title property is its empty attribute, and the tag's
 * title has to come from the option data on `.option`.  Reading the element's property gave every
 * tag an empty tooltip, whatever the options said.
 *
 * Setup: a multiple et2-select with options set as select_options, one with a title and one
 * without, both selected.
 *
 * Pass: the tag of the option with a title carries it (translated, or as is with noLang), the
 * other tag has no title.
 *
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 * @package api
 * @link https://www.egroupware.org
 */
import {assert, elementUpdated, fixture, html} from '@open-wc/testing';
import * as sinon from 'sinon';
import {Et2Select} from "../Et2Select";
import {egwStub, tagNodes, tagsReady} from "./helpers";

// @ts-ignore
window.egw = {...egwStub, tooltipBind: () => {}};

async function selectWithTitles(noLang : boolean) : Promise<Et2Select>
{
	// @ts-ignore
	const element = <Et2Select>await fixture(html`<et2-select multiple="true"></et2-select>`);
	// also keeps the import, which is otherwise only a type and dropped - the tag would not upgrade
	assert.instanceOf(element, Et2Select);
	sinon.stub(element, "egw").returns(window.egw);
	element.noLang = noLang;
	element.select_options = [
		{value: "one", label: "One", title: "What one is for"},
		{value: "two", label: "Two"}
	];
	element.value = ["one", "two"];
	await elementUpdated(element);
	await tagsReady(element);
	return element;
}

const titles = (element : Et2Select) =>
	Object.fromEntries(tagNodes(element).map(tag => [tag.value, tag.getAttribute("title")]));

describe("Select tag tooltip", () =>
{
	it("shows the option's title on its tag", async() =>
	{
		const element = await selectWithTitles(true);

		assert.deepEqual(titles(element), {one: "What one is for", two: null});
	});

	it("translates it like the option, unless noLang", async() =>
	{
		const element = await selectWithTitles(false);

		// egwStub.lang() marks what it translated with a trailing "*"
		assert.strictEqual(titles(element).one, "What one is for*");
	});
});
