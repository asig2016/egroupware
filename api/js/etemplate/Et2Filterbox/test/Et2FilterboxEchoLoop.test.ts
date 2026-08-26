import {assert} from "@open-wc/testing";
import {Et2Filterbox} from "../Et2Filterbox";

const wait = (ms : number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Contract under test:
 * - A widget that echoes a "change" after the filterbox itself set its value must not be
 *   mistaken for a user edit.
 *
 * Why this is not just tidiness: the echo path is
 *   handleFilterChange() -> applyFilters() -> nextmatch.applyFilters() -> "et2-filter"
 *   -> set value -> set_value() -> widget "change" -> handleFilterChange() -> ...
 * and it does not terminate. Any re-entrancy guard involved (`et2_nextmatch.update_in_progress`,
 * for one) is cleared synchronously, but a widget dispatches its "change" only after its own
 * updateComplete - a later microtask than the sync window - so the echo always arrives with the
 * guard already down. The result is a hung renderer with no error and no failing request.
 *
 * Setup strategy:
 * - A default-slot child standing in for the filter template, so the real `value` getter and
 *   `_templateValues` setter run: `getInstanceManager().getValues()` reads the stored values,
 *   `iterateOver()` hands back widgets whose `set_value()` writes them back.
 * - A fake nextmatch whose `applyFilters()` echoes straight back into `handleNextmatchFilter`,
 *   exactly as the real one does via its "et2-filter" event, and counts how often it was asked.
 * - Each round is then driven by hand rather than by a real event listener, so a regression
 *   fails the assertion instead of hanging the test runner.
 *
 * Pass criteria:
 * - Repeated echoes of an unchanged value reach the nextmatch exactly once.
 * - A genuine change after those echoes still gets through.
 */
describe("Et2Filterbox echo loop", () =>
{
	const buildFilterbox = () =>
	{
		const element = new Et2Filterbox();
		element.autoapply = true;

		const values : Record<string, any> = {group_by: "no_group"};

		const template = document.createElement("div") as any;
		template.getInstanceManager = () => ({getValues: () => ({...values})});
		template.iterateOver = (callback : Function) =>
		{
			Object.keys(values).forEach((id) =>
			{
				callback({id, set_value : (value : any) => { values[id] = value; }});
			});
		};
		element.append(template);

		const nextmatch = {
			applied: [] as any[],
			applyFilters(value : any)
			{
				this.applied.push(value);
				// what the real nextmatch does: push its state back at the filterbox
				(element as any).handleNextmatchFilter({detail: {activeFilters: {...value}}});
			},
			sortBy : () => {},
			getDOMNode : () => null
		};
		(element as any)._nextmatch = nextmatch;

		return {element, values, nextmatch};
	};

	it("stops re-applying when a widget echoes back the value it was just given", async() =>
	{
		const {element, values, nextmatch} = buildFilterbox();
		document.body.append(element);
        await element.updateComplete;

		// the user picks a different grouping
		values.group_by = "lines_only";
		(element as any).handleFilterChange(new Event("change"));
		await wait(5);

		// ...and now the widgets echo, repeatedly, exactly as they do in the browser
		for(let i = 0; i < 5; i++)
		{
			(element as any).handleFilterChange(new Event("change"));
			await wait(2);
		}

		assert.equal(nextmatch.applied.length, 1, "the echoes must not each re-apply the filters");
		assert.equal(nextmatch.applied[0].group_by, "lines_only", "the real change still got through");
		element.remove();
	});

	it("still applies a real change that follows the echoes", async() =>
	{
		const {element, values, nextmatch} = buildFilterbox();
		document.body.append(element);
		await element.updateComplete;

		values.group_by = "lines_only";
		(element as any).handleFilterChange(new Event("change"));
		await wait(5);
		(element as any).handleFilterChange(new Event("change"));
		await wait(2);

		// the user picks again - different value, so not an echo
		values.group_by = "by_account";
		(element as any).handleFilterChange(new Event("change"));
		await wait(5);

		assert.equal(nextmatch.applied.length, 2, "a genuine second change must still reach the nextmatch");
		assert.equal(nextmatch.applied[1].group_by, "by_account");
		element.remove();
	});

	it("leaves the explicit apply button working even when nothing changed", async() =>
	{
		const {element, nextmatch} = buildFilterbox();
		document.body.append(element);
		await element.updateComplete;

		// seed a sync, so a snapshot exists
		(element as any).handleNextmatchFilter({detail: {activeFilters: {group_by: "no_group"}}});
		await wait(5);

		// pressing Apply is explicit intent, not an echo - it goes through applyFilters() directly
		element.applyFilters();

		assert.equal(nextmatch.applied.length, 1, "the apply button must not be suppressed by echo detection");
		element.remove();
	});
});
