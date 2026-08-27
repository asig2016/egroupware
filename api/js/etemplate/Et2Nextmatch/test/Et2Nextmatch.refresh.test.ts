import {assert} from "@open-wc/testing";
import * as sinon from "sinon";
import {Et2Nextmatch} from "../Et2Nextmatch";

/**
 * Contract under test:
 * - `Et2Nextmatch.refresh()` normalizes the requested change type before forwarding it to the
 *   datagrid. That normalization matrix assumes the grid actually holds the named row; an
 *   "update"/"update-in-place" naming a row it does NOT hold is a new row in disguise (apps
 *   send "update" for a just-created entry too - achelper's basecf does so unconditionally)
 *   and has to be promoted to "add", exactly like the legacy nextmatch's id_loop did.
 *   Without the promotion an in-place update of a row that is not there is a silent no-op,
 *   so the new entry only appeared after a manual full reload.
 *
 * Setup strategy:
 * - Render a real `et2-nextmatch`, stub `egw().preference("lazy-update")` per case, and set
 *   `_filters.sort`/`modifiedDateField` to control `_isSortedByModified()`.
 * - Stub the real child datagrid's `refresh()` to capture the type it actually receives, and
 *   its `hasRow()` to report the row as unknown.
 *
 * Pass criteria:
 * - For a row the grid does not hold, "update"/"update-in-place" forward as "add" ("edit"
 *   under lazy-update=exact while not sorted by modified); other types are unaffected.
 *
 * Environment: browser test runner, no server or session; see doc/ai/testing.md.
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

describe("Et2Nextmatch.refresh() promotion of updates naming a row the grid does not hold", () =>
{
	/**
	 * [inputType, lazy-update pref, sortedByModified, expectedForwardedType]
	 *
	 * Under lazy-update=exact while not sorted by modified, "add" itself means a full reload
	 * ("edit"), so the promotion lands there instead.
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
