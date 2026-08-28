import {assert} from "@open-wc/testing";
import * as sinon from "sinon";
import {Et2Nextmatch} from "../Et2Nextmatch";

/**
 * Contract under test:
 * - A hard reload (bare `applyFilters()`) turns Et2NextmatchDataProvider's fresh-known-uids
 *   override on and watches the datagrid's loading events to decide when to turn it back off
 *   again (`_armForceFreshKnownUids()`).
 * - Those listeners belong to one arming: a second hard reload must take the first one's
 *   listeners off before installing its own, and must take them off the datagrid they were
 *   added to even if the widget has rendered a new one since.
 *
 * Why this is pinned: every arming builds its own three closures, and only that arming's own
 * cleanup() can remove them - and cleanup() only runs from the single shared idle timer. So an
 * arming landing before that timer fired (two Reload clicks in a row, or a reload while the
 * previous one was still settling) left the earlier generation's three listeners on the grid
 * with nothing able to remove them any more. Measured live on 2026-08-28 before the fix: five
 * reloads 1.5s apart added 15 listeners and removed 3, and the backlog stayed - later reloads
 * only ever cleaned up their own generation, while every load kept running all the orphans.
 *
 * Setup strategy:
 * - A bare `Et2Nextmatch`, deliberately left unmounted (attaching one starts the real datagrid
 *   rendering and data-fetch machinery, which crashes the page in a test fixture - same reason
 *   acemailstor/js/test/NmFilterContract.test.ts constructs one detached), with a plain element
 *   standing in for the datagrid: the arming only ever calls add/removeEventListener on it, and
 *   reload() to start the fetch.
 * - Count those calls, restricted to the `et2-loading-*` events this mechanism uses.
 * - Wait out the real idle timer where the turn-off is under test - it is 1.5s, and faking
 *   timers crashes the renderer here.
 *
 * Pass criteria:
 * - After N hard reloads, exactly one generation of listeners is on the grid.
 * - The idle timer removes that generation and turns the override off.
 * - Re-arming after the datagrid was replaced cleans up the old grid, not the new one.
 * - Disconnecting the widget leaves no pending timer and no listeners behind.
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
	uid: () => "nm-force-fresh-test",
	debug: () => {}
};
window.egw = function() { return egwStub; } as any;
Object.assign(window.egw, egwStub);

const wait = (ms : number) => new Promise(resolve => setTimeout(resolve, ms));

const LOADING_EVENTS = ["et2-loading-done", "et2-loading-error", "et2-loading-start"];

/** add/removeEventListener calls for the events this mechanism uses, by event name */
function loadingListenerCounts(spy : sinon.SinonSpy) : Record<string, number>
{
	return spy.getCalls()
		.map(call => String(call.args[0]))
		.filter(type => LOADING_EVENTS.includes(type))
		.reduce((counts, type) =>
		{
			counts[type] = (counts[type] ?? 0) + 1;
			return counts;
		}, {} as Record<string, number>);
}

describe("Et2Nextmatch hard-reload fresh-known-uids arming", () =>
{
	let el : Et2Nextmatch;
	let datagrid : any;
	let provider : { setForceFreshKnownUids : sinon.SinonSpy };
	let added : sinon.SinonSpy;
	let removed : sinon.SinonSpy;

	/** Something that dispatches and records listeners, which is all the arming asks of a grid */
	function stubDatagrid() : any
	{
		const grid : any = document.createElement('div');
		grid.reload = sinon.stub().resolves();
		return grid;
	}

	/**
	 * `_datagrid` is a getter that queries the shadow root for the currently rendered grid, so
	 * a stand-in is put in front of it the same way - which is also how the "the grid was
	 * replaced" case below swaps one for another.
	 */
	function useDatagrid(grid : any)
	{
		Object.defineProperty(el, '_datagrid', {get: () => grid, configurable: true});
	}

	before(() =>
	{
		// One widget for the whole file: it is never attached, so there is nothing per-test
		// state on it besides the arming under test, and building nextmatches is not cheap
		el = new Et2Nextmatch();
	});

	beforeEach(() =>
	{
		(el as any)._forceFreshKnownUidsCleanup?.();
		(el as any)._forceFreshKnownUidsCleanup = null;
		(el as any)._forceFreshKnownUidsIdleTimer = null;

		datagrid = stubDatagrid();
		useDatagrid(datagrid);

		provider = {setForceFreshKnownUids: sinon.spy()};
		(el as any)._dataProvider = provider;

		added = sinon.spy(datagrid, "addEventListener");
		removed = sinon.spy(datagrid, "removeEventListener");
	});

	afterEach(() =>
	{
		sinon.restore();
	});

	it("leaves one generation of listeners behind, however many hard reloads arrive", () =>
	{
		for(let i = 0; i < 5; i++)
		{
			el.applyFilters();
		}

		const adds = loadingListenerCounts(added);
		const removes = loadingListenerCounts(removed);
		LOADING_EVENTS.forEach(type =>
		{
			assert.equal(adds[type], 5, `every reload arms ${type}`);
			assert.equal(
				(adds[type] ?? 0) - (removes[type] ?? 0), 1,
				`only the newest arming's ${type} listener may still be on the grid - the others are unreachable once re-armed`
			);
		});
	});

	it("removes the listeners and turns the override off once the grid has been idle", async function()
	{
		// waits out the real 1.5s idle timer
		this.timeout(10000);

		el.applyFilters();
		provider.setForceFreshKnownUids.resetHistory();

		datagrid.dispatchEvent(new CustomEvent("et2-loading-done"));
		await wait(2000);

		assert.isTrue(
			provider.setForceFreshKnownUids.calledOnceWith(false),
			"the idle timer turns the override back off"
		);
		const removes = loadingListenerCounts(removed);
		LOADING_EVENTS.forEach(type => assert.equal(removes[type], 1, `and takes its ${type} listener off again`));
	});

	it("keeps the override on while pages of the same reload are still arriving", async function()
	{
		// waits past the real 1.5s idle timer to prove the turn-off was cancelled, not delayed
		this.timeout(10000);

		el.applyFilters();
		provider.setForceFreshKnownUids.resetHistory();

		// gap between two pages of one reload: idle, then loading again before the timer fires
		datagrid.dispatchEvent(new CustomEvent("et2-loading-done"));
		await wait(500);
		datagrid.dispatchEvent(new CustomEvent("et2-loading-start"));
		await wait(2500);

		assert.isTrue(provider.setForceFreshKnownUids.notCalled, "the pending turn-off is cancelled, not just delayed");
		const removes = loadingListenerCounts(removed);
		LOADING_EVENTS.forEach(type => assert.isUndefined(removes[type], `the ${type} listener stays on for the next page`));
	});

	it("cleans up the datagrid it armed on, not the one that replaced it", async() =>
	{
		el.applyFilters();

		// a template switch renders a new datagrid - the old one still carries the listeners
		const replacement = stubDatagrid();
		const replacementAdded = sinon.spy(replacement, "addEventListener");
		useDatagrid(replacement);

		el.applyFilters();

		const removes = loadingListenerCounts(removed);
		LOADING_EVENTS.forEach(type =>
		{
			assert.equal(removes[type], 1, `the ${type} listener must come off the grid it went on`);
			assert.equal(loadingListenerCounts(replacementAdded)[type], 1, `and the new grid gets its own ${type} listener`);
		});
	});

	it("leaves nothing pending when the widget is disconnected mid-reload", () =>
	{
		el.applyFilters();

		// the widget is never attached here (see the setup note), so the browser will not call
		// this for us - it is what a real detach runs
		el.disconnectedCallback();

		const removes = loadingListenerCounts(removed);
		LOADING_EVENTS.forEach(type => assert.equal(removes[type], 1, `disconnecting takes the ${type} listener off`));
		assert.isNull((el as any)._forceFreshKnownUidsIdleTimer, "and leaves no timer running");
	});
});
