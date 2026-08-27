import {assert} from "@open-wc/testing";
import {Et2Datagrid} from "../Et2Datagrid";

/**
 * Contract for Et2Datagrid.hasRow(), which Et2Nextmatch.refresh() asks before it promotes an
 * "update" naming an unknown row to an "add".
 *
 * Setup: a real grid with a stubbed provider and its materialized row ids set directly, plus a
 * real child grid placed in an expanded row of its shadow root.
 *
 * Pass criteria: a materialized row is held, by row id or datastore uid; a row only an expanded
 * child grid holds is held too, as its update is passed on to that grid and must not be
 * promoted to an add in the parent; any other row is not held.
 */

const PREFIX = "projectmanager_elements::";
const hosts : HTMLElement[] = [];

async function connectedGrid(rowIds : string[]) : Promise<Et2Datagrid>
{
	const host = document.createElement("div");
	document.body.appendChild(host);
	hosts.push(host);
	const grid = new Et2Datagrid();
	host.appendChild(grid);
	await grid.updateComplete;
	grid.dataProvider = {
		normalizeRowId: (rowId : string) => rowId.startsWith(PREFIX) ? rowId : PREFIX + rowId,
		toProviderRowId: (rowId : string) => rowId.replace(PREFIX, "")
	} as any;
	(grid as any).displayedRowIds = new Set(rowIds.map((rowId) => PREFIX + rowId));
	return grid;
}

describe("Et2Datagrid.hasRow()", () =>
{
	afterEach(() =>
	{
		while(hosts.length)
		{
			hosts.pop()!.remove();
		}
	});

	it("holds a materialized row, by row id or datastore uid", async() =>
	{
		const grid = await connectedGrid(["infolog:5:42"]);

		assert.isTrue(grid.hasRow("infolog:5:42"));
		assert.isTrue(grid.hasRow(`${PREFIX}infolog:5:42`));
		assert.isFalse(grid.hasRow("infolog:5:43"));
	});

	it("holds a row of an expanded child grid", async() =>
	{
		const parent = await connectedGrid(["project:5"]);
		const child = await connectedGrid(["infolog:5:42"]);
		const expandedRow = document.createElement("tr");
		expandedRow.setAttribute("data-dg-expanded-row", "1");
		expandedRow.appendChild(child);
		parent.shadowRoot!.appendChild(expandedRow);

		assert.isTrue(parent.hasRow("infolog:5:42"), "its update would be promoted to an add in the parent");
		assert.isFalse(parent.hasRow("infolog:6:43"));
	});
});
