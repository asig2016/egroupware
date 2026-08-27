import {assert} from "@open-wc/testing";
import * as sinon from "sinon";
import {Et2Nextmatch} from "../Et2Nextmatch";

/**
 * Contract under test:
 * - `Et2Nextmatch.refresh()`'s docblock documents a type/preference/sort matrix that
 *   normalizes the requested change type ("update", "update-in-place", "edit", "delete",
 *   "add") before forwarding it to the datagrid, based on the "lazy-update" preference and
 *   whether the grid is currently sorted by the modified-date field.
 *
 * Setup strategy:
 * - Render a real `et2-nextmatch`, stub `egw().preference("lazy-update")` per case, and set
 *   `_filters.sort`/`modifiedDateField` to control `_isSortedByModified()`.
 * - Stub the real child datagrid's `refresh()` to capture the type it actually receives, and
 *   its `hasRow()` to control whether the grid "holds" the refreshed row - the docblock matrix
 *   applies to rows the grid holds; an "update"/"update-in-place" naming a row it does NOT
 *   hold is a new row in disguise (apps send "update" for a just-created entry too) and is
 *   promoted to "add"/"edit" exactly like the legacy nextmatch's id_loop did.
 *
 * Pass criteria:
 * - The forwarded type matches the docblock's documented table for every
 *   (input type, preference, sorted) combination when the grid holds the row.
 * - For a row the grid does not hold, "update"/"update-in-place" forward as "add" ("edit"
 *   under lazy-update=exact while not sorted by modified); other types are unaffected.
 */

const egwStub = {
	lang: (label : string) => label,
	image: () => "",
	tooltipBind: () => {},
	tooltipUnbind: () => {},
	preference: (_key? : string) => null as any,
	set_preference: () => {},
	app_name: () => "addressbook",
	link: (url : string) => url,
	uid: () => "nm-refresh-test",
	debug: () => {}
};
window.egw = function() { return egwStub; } as any;
Object.assign(window.egw, egwStub);

async function createReadyNextmatch() : Promise<Et2Nextmatch>
{
	const el = new Et2Nextmatch();
	document.body.append(el);
	await el.updateComplete;
	return el;
}

describe("Et2Nextmatch.refresh() type/preference/sort dispatch matrix", () =>
{
	/**
	 * [inputType, lazy-update pref, sortedByModified, expectedForwardedType, docblock line it exercises]
	 */
	const cases : Array<[string, string, boolean, string, string]> = [
		// --- add ---
		["add", "lazy", true, "add", "lazy: add always on top"],
		["add", "lazy", false, "add", "lazy: add always on top"],
		["add", "exact", true, "add", "exact: add ... on top if sorted by last modified"],
		["add", "exact", false, "edit", "exact: add ... otherwise full refresh"],

		// --- update ---
		["update", "lazy", true, "update", "lazy: updates on top, if sorted by last modified"],
		["update", "lazy", false, "update-in-place", "lazy: ... otherwise update-in-place"],
		["update", "exact", true, "update", "exact: add and update on top if sorted by last modified"],
		["update", "exact", false, "edit", "exact: ... otherwise full refresh"],

		// --- update-in-place: documented as *always* in place, regardless of pref/sort ---
		["update-in-place", "lazy", true, "update-in-place", "update-in-place is always in place!"],
		["update-in-place", "lazy", false, "update-in-place", "update-in-place is always in place!"],
		["update-in-place", "exact", true, "update-in-place", "update-in-place is always in place!"],
		["update-in-place", "exact", false, "update-in-place", "update-in-place is always in place!"],

		// --- edit: documented as always a full reload ---
		["edit", "lazy", true, "edit", "edit: ... Full reload"],
		["edit", "lazy", false, "edit", "edit: ... Full reload"],
		["edit", "exact", true, "edit", "edit: ... Full reload"],
		["edit", "exact", false, "edit", "edit: ... Full reload"],

		// --- delete: documented as always client-side, no server interaction ---
		["delete", "lazy", true, "delete", "delete: ... no server interaction necessary"],
		["delete", "lazy", false, "delete", "delete: ... no server interaction necessary"],
		["delete", "exact", true, "delete", "delete: ... no server interaction necessary"],
		["delete", "exact", false, "delete", "delete: ... no server interaction necessary"]
	];

	cases.forEach(([inputType, pref, sorted, expectedType, docNote]) =>
	{
		it(`forwards "${inputType}" as "${expectedType}" when lazy-update=${pref}, sortedByModified=${sorted} [${docNote}]`, async() =>
		{
			const el = await createReadyNextmatch();
			el.modifiedDateField = "modified";
			(el as any)._filters = sorted
				? {sort: {id: "modified", asc: false}}
				: {sort: {id: "other-field", asc: true}};

			// `Et2Widget.egw()` resolves through `window['egw']` itself (which has egwStub's
			// properties copied onto it via `Object.assign`), not through the `egwStub` object
			// reference - so the override has to land on the same object `.egw()` returns.
			const liveEgw = (el as any).egw();
			const originalPreference = liveEgw.preference;
			liveEgw.preference = (key? : string) => key === "lazy-update" ? pref : null;

			const datagrid = (el as any)._datagrid;
			assert.isNotNull(datagrid, "test setup: real child datagrid should be rendered");
			const refreshStub = sinon.stub(datagrid, "refresh").resolves();
			// the docblock matrix is for rows the grid holds - unknown rows are covered below
			const hasRowStub = sinon.stub(datagrid, "hasRow").returns(true);

			try
			{
				// Guard the test setup itself: if either stub isn't actually visible to the
				// widget, the assertion below would silently exercise the wrong preference/sort
				// combination instead of failing loudly.
				assert.equal((el as any).egw().preference("lazy-update"), pref, "test setup: preference stub should be visible to the widget");
				assert.equal((el as any)._isSortedByModified(), sorted, "test setup: sort stub should be visible to the widget");
				el.refresh(["row-1"], inputType as any);

				assert.isTrue(refreshStub.calledOnce, "datagrid.refresh should be called exactly once");
				assert.equal(
					refreshStub.firstCall.args[1],
					expectedType,
					`"${inputType}" (pref=${pref}, sorted=${sorted}) should forward as "${expectedType}" per docblock`
				);
			}
			finally
			{
				liveEgw.preference = originalPreference;
				refreshStub.restore();
				hasRowStub.restore();
				el.remove();
			}
		});
	});
});

describe("Et2Nextmatch.refresh() promotion of updates naming a row the grid does not hold", () =>
{
	/**
	 * [inputType, lazy-update pref, sortedByModified, expectedForwardedType]
	 *
	 * Legacy parity (et2_extension_nextmatch's id_loop): "update" AND "update-in-place" for an
	 * unknown row become "add" - a just-created entry is announced with type "update" by apps
	 * (achelper's basecf unconditionally), and an in-place update of a row that is not there
	 * is a silent no-op, so without the promotion the new row never appeared. Under
	 * lazy-update=exact while not sorted by modified, "add" itself means a full reload ("edit").
	 */
	const cases : Array<[string, string, boolean, string]> = [
		["update", "lazy", true, "add"],
		["update", "lazy", false, "add"],
		["update", "exact", true, "add"],
		["update", "exact", false, "edit"],	// already "edit" before the promotion is reached
		["update-in-place", "lazy", true, "add"],
		["update-in-place", "lazy", false, "add"],
		["update-in-place", "exact", true, "add"],
		["update-in-place", "exact", false, "edit"],
		// unaffected types: the promotion only rewrites update/update-in-place
		["add", "lazy", false, "add"],
		["edit", "lazy", false, "edit"],
		["delete", "lazy", false, "delete"]
	];

	cases.forEach(([inputType, pref, sorted, expectedType]) =>
	{
		it(`forwards "${inputType}" for an unknown row as "${expectedType}" when lazy-update=${pref}, sortedByModified=${sorted}`, async() =>
		{
			const el = await createReadyNextmatch();
			el.modifiedDateField = "modified";
			(el as any)._filters = sorted
				? {sort: {id: "modified", asc: false}}
				: {sort: {id: "other-field", asc: true}};

			const liveEgw = (el as any).egw();
			const originalPreference = liveEgw.preference;
			liveEgw.preference = (key? : string) => key === "lazy-update" ? pref : null;

			const datagrid = (el as any)._datagrid;
			const refreshStub = sinon.stub(datagrid, "refresh").resolves();
			const hasRowStub = sinon.stub(datagrid, "hasRow").returns(false);

			try
			{
				el.refresh(["row-unknown"], inputType as any);

				assert.isTrue(refreshStub.calledOnce, "datagrid.refresh should be called exactly once");
				assert.equal(
					refreshStub.firstCall.args[1],
					expectedType,
					`"${inputType}" for an unknown row (pref=${pref}, sorted=${sorted}) should forward as "${expectedType}"`
				);
			}
			finally
			{
				liveEgw.preference = originalPreference;
				refreshStub.restore();
				hasRowStub.restore();
				el.remove();
			}
		});
	});
});
