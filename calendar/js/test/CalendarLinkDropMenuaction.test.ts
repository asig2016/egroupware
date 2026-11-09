import {assert} from "@open-wc/testing";

/**
 * Contract: the calendar's drop/paste "link" of an entry onto an event calls the namespaced
 * Etemplate\Widget\Link::ajax_link, not the pre-namespace etemplate_widget_link.
 *
 * Why it matters: "<app>.etemplate_widget_link.ajax_link.etemplate" is refused by the server
 * ("Class 'etemplate_widget_link' does NOT belong to application 'calendar'", Bad Request), so
 * Paste > Create link and dropping an entry on an event in the week/day views (timegrid) and the
 * planner linked nothing.
 *
 * Setup: the sources of both views, as served.
 *
 * Pass criteria: each calls "EGroupware\\Api\\Etemplate\\Widget\\Link::ajax_link" and none
 * names etemplate_widget_link.
 *
 * Environment: no network beyond the test server.
 */
const SOURCES = ['/calendar/js/et2_widget_timegrid.ts', '/calendar/js/et2_widget_planner.ts'];

describe('calendar link drop menuaction', () =>
{
	for(const source of SOURCES)
	{
		it(source + ' links through the namespaced Link widget', async() =>
		{
			const code = await (await fetch(source)).text();

			assert.isAbove(code.length, 0, 'source not served');
			assert.notInclude(code, 'etemplate_widget_link', 'pre-namespace class still called');
			// the test server serves the source transformed: quotes and spacing may differ
			assert.match(code, /egw\.json\(\s*["']EGroupware\\\\Api\\\\Etemplate\\\\Widget\\\\Link::ajax_link["']/,
				'namespaced Link::ajax_link not called');
		});
	}
});
