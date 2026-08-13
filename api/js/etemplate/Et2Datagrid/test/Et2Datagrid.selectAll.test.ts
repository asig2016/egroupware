import {assert} from "@open-wc/testing";
import {isPhysicalAKey} from "../Et2DatagridKeyboard.ts";

/**
 * Contract under test
 *
 * Ctrl+A selects every row of a datagrid, whatever keyboard layout the user types on.
 *
 * WHY THE LAYOUT IS THE POINT
 * KeyboardEvent.key carries the CHARACTER the active layout produces, and browsers apply the layout
 * even while Ctrl is held: on a Greek layout the physical A key reports key = "α", on a Cyrillic one
 * "ф". Et2Datagrid._handleTableKeydown() used to test `event.key === "a"`, so Ctrl+A stopped
 * selecting anything as soon as the user switched layout - silently, and with every other shortcut
 * in the grid (arrows, Home/End, Space) still working, because those keys are named the same in
 * every layout.
 *
 * That was a regression the migration off the legacy nextmatch introduced rather than a new
 * requirement: the old path went through EgwActionObject.handleKeyPress(), which matched
 * EGW_KEY_A = 65 against event.keyCode - and keyCode falls back to the Latin value for non-Latin
 * layouts, so it never had this problem.
 *
 * Setup strategy
 *
 * The layout-independent decision lives in Et2DatagridKeyboard.ts rather than in the widget, so this
 * imports and exercises the shipped predicate. Driving _handleTableKeydown() itself is not an option
 * here: importing Et2Datagrid.ts pulls in the whole etemplate widget graph, whose checked-in .js
 * artefacts are stale enough that the module fails to load in the test runner (Et2Widget.js is
 * missing exports the current source has). That staleness does not affect the browser, which runs
 * the rollup chunk built from the .ts.
 *
 * The ".ts" on the import above is deliberate for the same reason - an extensionless specifier
 * resolves to the checked-in .js.
 *
 * Pass criteria
 *
 * 1. The physical A key is recognised on US, Greek and Cyrillic layouts.
 * 2. Other keys are not - notably the ones whose CHARACTER is "a" on some layout while sitting
 *    somewhere else on the keyboard.
 * 3. Events without a code (synthetic replays) still work off the character.
 *
 * Environment
 *
 * No server, no session, no DOM. Runs in the browser test runner; see doc/ai/testing.md.
 */

/**
 * A keydown for the physical A key as the given layout delivers it
 */
const physicalA = (character : string) =>
	new KeyboardEvent("keydown", {key: character, code: "KeyA", ctrlKey: true});

describe("Et2Datagrid select-all shortcut", () =>
{
	it("recognises the A key on a US layout", () =>
	{
		assert.isTrue(isPhysicalAKey(physicalA("a")));
		assert.isTrue(isPhysicalAKey(physicalA("A")), "... and with caps lock or shift on");
	});

	it("recognises the A key on a Greek layout", () =>
	{
		// what Chrome reports for the physical A key while the layout is Greek
		assert.isTrue(isPhysicalAKey(physicalA("α")),
			"the shortcut is the key, not the character it happens to produce");
	});

	it("recognises the A key on a Cyrillic layout", () =>
	{
		assert.isTrue(isPhysicalAKey(physicalA("ф")));
	});

	it("does not recognise other keys, whatever character they produce", () =>
	{
		assert.isFalse(isPhysicalAKey(new KeyboardEvent("keydown", {key: "s", code: "KeyS"})));
		assert.isFalse(isPhysicalAKey(new KeyboardEvent("keydown", {key: "ArrowDown", code: "ArrowDown"})));

		// the trap this fix must not fall into in reverse: on a Greek layout the character "a" is
		// not produced at all, but on eg. a Dvorak layout it comes from the physical S position -
		// matching by character would fire the shortcut from the wrong key
		assert.isFalse(isPhysicalAKey(new KeyboardEvent("keydown", {key: "a", code: "KeyS"})),
			"the character alone must not decide when the position is known");
	});

	it("falls back to the character when the event carries no code", () =>
	{
		// the grid replays navigation keys as bare KeyboardEvents, and some virtual keyboards send
		// no code either - such an event must still be usable rather than silently unmatched
		assert.isTrue(isPhysicalAKey(new KeyboardEvent("keydown", {key: "a"})));
		assert.isTrue(isPhysicalAKey(new KeyboardEvent("keydown", {key: "A"})));
		assert.isFalse(isPhysicalAKey(new KeyboardEvent("keydown", {key: "ArrowUp"})));
	});
});
