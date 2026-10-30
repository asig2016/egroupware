import {assert} from "@open-wc/testing";
import {Et2DatagridRowRenderer} from "../Et2DatagridRowRenderer";
import {Et2DatagridSelectionController} from "../Et2DatagridSelectionController";

/**
 * Contract: Et2DatagridRowRenderer.guardFocusAfterVirtualMutation() must put keyboard
 * focus back on the active row after row DOM churn - a re-render replaces row elements
 * outright, which drops focus to the document body and would otherwise end keyboard
 * navigation.  Parking focus on the grid itself is only a stopgap for the case where
 * the replacement row is not mounted yet: it keeps key events flowing but visibly drops
 * the row's focus ring, and it must not become the resting state.
 *
 * <body> is not always focus the grid lost, though: it is also what document.activeElement
 * reports while the browser moves focus from one control to the next, while the blur
 * handlers of the control being left run.  When such a handler changes a filter (an input
 * committing its value on blur), the rows are replaced right there.  Taking the focus then
 * cancels the browser's move - Tab between two date fields of a filter panel landed on the
 * list instead.  The grid remembers the last control outside itself that got focus and
 * leaves focus alone while that control is still on the page
 * (Et2DatagridSelectionController.focusIsOnOtherControl()).
 *
 * Setup: a stub host with a real shadow root holding a grid element and one row, so
 * focus is exercised for real rather than asserted against a faked activeElement.  Its
 * focus methods are the real Et2DatagridSelectionController's, following focus for real
 * too.  A move between two controls is a real focus() call, with the rows replaced from
 * a blur listener of the control being left - where the browser runs it.
 *
 * Pass criteria: the row ends up focused when it is mounted, a previous stopgap parked
 * on the grid is still recovered to the row, focus the user moved elsewhere on purpose
 * is left alone - also while it is on its way from one control to the next - and focus
 * whose control is gone, or that went to the application frame, is taken back.
 */

function createStubHost(withRow : boolean = true)
{
	const host = document.createElement("div") as any;
	const shadow = host.attachShadow({mode: "open"});
	shadow.innerHTML = `
		<table role="grid" tabindex="-1">
			<tbody id="rows">
				${withRow ? `<tr data-row-index="0" tabindex="0"><td></td></tr>` : ""}
			</tbody>
		</table>
	`;
	host.activeRowIndex = 0;
	host._restoreFocusAfterRender = false;
	Object.defineProperty(host, "_gridTable", {
		get: () => shadow.querySelector("[role='grid']")
	});
	Object.defineProperty(host, "_rowsBody", {
		get: () => shadow.querySelector("#rows")
	});
	// Et2Datagrid hands both on to its selection controller the same way
	const selection = new Et2DatagridSelectionController(host);
	host._focusRowByIndex = (index : number, retries : number = 0, allowScroll : boolean = true) =>
		selection.focusRowByIndex(index, retries, allowScroll);
	host._focusIsOnOtherControl = () => selection.focusIsOnOtherControl();
	host._selection = selection;
	document.body.append(host);
	// what Et2Datagrid.connectedCallback() does
	selection.trackFocus();
	return {host, shadow};
}

/**
 * Two controls outside the grid, the first one focused
 */
function createControls()
{
	const first = document.createElement("input");
	first.id = "first";
	const next = document.createElement("input");
	next.id = "next";
	document.body.append(first, next);
	first.focus();
	return {first, next};
}

describe("Et2DatagridRowRenderer focus guard", () =>
{
	let hosts : HTMLElement[] = [];

	let controls : HTMLElement[] = [];

	afterEach(() =>
	{
		hosts.forEach((host : any) =>
		{
			host._selection?.untrackFocus();
			host.remove();
		});
		hosts = [];
		controls.forEach((control) => control.remove());
		controls = [];
	});

	const guard = (host : any) =>
	{
		hosts.push(host);
		new Et2DatagridRowRenderer(host as any)["guardFocusAfterVirtualMutation"]();
	};

	// Compare a short label rather than the elements themselves: a failing assertion on
	// two DOM nodes makes the test runner serialize whole subtrees.
	const focused = (shadow : ShadowRoot) =>
	{
		const active = shadow.activeElement as HTMLElement | null;
		if(!active) return "none";
		return active.hasAttribute("data-row-index") ? "row" : active.tagName.toLowerCase();
	};

	it("returns focus to the active row after a re-render dropped it", () =>
	{
		const {host, shadow} = createStubHost();
		(document.activeElement as HTMLElement)?.blur?.();
		guard(host);
		assert.strictEqual(focused(shadow), "row",
			"row that is mounted again should take focus back directly");
	});

	it("recovers focus parked on the grid by an earlier mutation", () =>
	{
		const {host, shadow} = createStubHost();
		// The stopgap state: document.activeElement is then the shadow host, which the
		// "user moved to another control" check must not mistake for a deliberate move.
		(shadow.querySelector("[role='grid']") as HTMLElement).focus();
		assert.strictEqual(focused(shadow), "table", "precondition");

		guard(host);
		assert.strictEqual(focused(shadow), "row",
			"focus parked on the grid should be handed back to the active row");
	});

	it("falls back to the grid while no row is mounted, so keys keep reaching it", () =>
	{
		const {host, shadow} = createStubHost(false);
		(document.activeElement as HTMLElement)?.blur?.();
		guard(host);
		assert.strictEqual(focused(shadow), "table",
			"with no row to focus, the grid keeps keyboard events alive");
		assert.isTrue(host._restoreFocusAfterRender,
			"a later render must be told to put focus back on the row");
	});

	it("leaves focus the user moved to another control alone", () =>
	{
		const {host, shadow} = createStubHost();
		const elsewhere = document.createElement("input");
		document.body.append(elsewhere);
		elsewhere.focus();
		try
		{
			guard(host);
			assert.strictEqual((document.activeElement as HTMLElement)?.tagName.toLowerCase(), "input",
				"deliberate focus must not be stolen");
			assert.strictEqual(focused(shadow), "none", "nothing inside the grid should have taken focus");
		}
		finally
		{
			elsewhere.remove();
		}
	});
	/**
	 * The bug this guards against: focus is on its way from one control to the next, the
	 * first one's blur handler changes a filter, the rows are replaced - and the grid must
	 * not take the focus, or the browser drops the move.
	 */
	it("leaves focus on its way from one control to the next alone, when the rows are replaced on the way", () =>
	{
		const {host, shadow} = createStubHost();
		const {first, next} = createControls();
		controls.push(first, next);
		first.addEventListener("blur", () =>
		{
			assert.strictEqual(document.activeElement, document.body,
				"precondition: between the two controls focus is on <body>");
			guard(host);
		}, {once: true});

		next.focus();

		assert.strictEqual((document.activeElement as HTMLElement)?.id, "next",
			"focus should arrive at the next control");
		assert.strictEqual(focused(shadow), "none", "nothing inside the grid should have taken focus");
	});

	it("does not take it back on the render after the rows either", () =>
	{
		const {host, shadow} = createStubHost();
		hosts.push(host);
		const {first, next} = createControls();
		controls.push(first, next);
		// Et2Datagrid.updated() restoring focus after a render, see _restoreFocusAfterRender
		first.addEventListener("blur", () => host._focusRowByIndex(0, 0, false), {once: true});

		next.focus();

		assert.strictEqual((document.activeElement as HTMLElement)?.id, "next",
			"focus should arrive at the next control");
		assert.strictEqual(focused(shadow), "none", "the row should not have taken focus");
	});

	it("takes focus back once the control that had it is gone", () =>
	{
		const {host, shadow} = createStubHost();
		const {first, next} = createControls();
		controls.push(next);
		// eg. a dialog that is closed: focus falls to <body> and has nowhere else to be
		first.remove();

		guard(host);

		assert.strictEqual(focused(shadow), "row", "the row should take focus back");
	});

	it("takes focus back after it went to the application frame", () =>
	{
		const {host, shadow} = createStubHost();
		const {first, next} = createControls();
		const frame = document.createElement("egw-app");
		frame.tabIndex = -1;
		document.body.append(frame);
		controls.push(first, next, frame);
		// a click on the frame around the list is the user leaving the control
		frame.focus();
		frame.blur();

		guard(host);

		assert.strictEqual(focused(shadow), "row", "the row should take focus back");
	});
});
