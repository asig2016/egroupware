import {assert} from "@open-wc/testing";
import {Et2Datagrid} from "../Et2Datagrid";

/**
 * Contract: Et2Datagrid follows where focus goes while it is connected, so the focus
 * restore after a re-render can tell focus the grid lost from focus the user put on
 * another control (Et2DatagridSelectionController.focusIsOnOtherControl(), the restore
 * itself is in Et2DatagridRowRendererFocusGuard.test.ts).  A grid that is not on the
 * page must not keep a document listener, nor hold on to an element.
 *
 * Setup: a real grid without rows, attached to and detached from the document, and a
 * plain input outside it taking focus.
 *
 * Pass: focus on the input counts while the input is on the page, stops counting when
 * it is removed, and a detached grid neither counts it nor starts again until attached.
 */

const egw = {
	debug: () => {},
	lang: (label : string) => label,
	tooltipBind: () => {},
	tooltipUnbind: () => {},
	preference: () => null,
	set_preference: () => {},
	app_name: () => "addressbook",
	link: (url : string) => url
};
window.egw = function() { return egw; } as any;
Object.assign(window.egw, egw);

describe("Et2Datagrid focus on another control", () =>
{
	let grid : Et2Datagrid;
	let input : HTMLInputElement;

	beforeEach(async() =>
	{
		grid = new Et2Datagrid();
		grid.columns = [{key: "label", title: "Label", width: "1fr"}] as any;
		grid.templateData = {columns: grid.columns} as any;
		document.body.append(grid);
		await grid.updateComplete;
		input = document.createElement("input");
		document.body.append(input);
	});

	afterEach(() =>
	{
		grid.remove();
		input.remove();
	});

	it("counts focus on a control outside while that control is on the page", () =>
	{
		assert.isFalse((grid as any)._focusIsOnOtherControl(), "nothing focused yet");

		input.focus();
		assert.isTrue((grid as any)._focusIsOnOtherControl(), "the input has focus");

		input.blur();
		assert.isTrue((grid as any)._focusIsOnOtherControl(),
			"<body> alone does not say the user left the input - it is what focus is between two controls");

		input.remove();
		assert.isFalse((grid as any)._focusIsOnOtherControl(), "a removed control holds no focus");
	});

	it("follows focus only while attached", () =>
	{
		input.focus();
		grid.remove();
		assert.isFalse((grid as any)._focusIsOnOtherControl(), "a detached grid forgets the control");

		input.blur();
		input.focus();
		assert.isFalse((grid as any)._focusIsOnOtherControl(), "a detached grid does not follow focus");

		document.body.append(grid);
		input.blur();
		input.focus();
		assert.isTrue((grid as any)._focusIsOnOtherControl(), "attached again, it follows focus again");
	});
});
