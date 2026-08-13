/**
 * Layout-independent key identification for the datagrid's keyboard shortcuts
 *
 * Kept out of Et2Datagrid.ts so it can be tested without constructing a grid - importing
 * Et2Datagrid.ts drags in the whole etemplate widget graph. See test/Et2Datagrid.selectAll.test.ts.
 *
 * WHY THIS EXISTS
 * KeyboardEvent.key carries the CHARACTER the active keyboard layout produces, and browsers apply
 * the layout even while Ctrl is held: the physical A key reports "a" on a US layout, "α" on a Greek
 * one and "ф" on a Cyrillic one. A shortcut written as `event.key === "a"` therefore works only for
 * Latin typists, and fails silently for everyone else - no error, and every other shortcut in the
 * grid (arrows, Home/End, Space) keeps working, because those keys are named the same everywhere.
 *
 * The legacy nextmatch did not have this problem: it went through EgwActionObject.handleKeyPress(),
 * which matched EGW_KEY_A = 65 against event.keyCode, and keyCode falls back to the Latin value for
 * non-Latin layouts. Anything replacing that path has to stay equally layout-independent, which
 * means asking event.code - the name of the key's POSITION, not of the character it produces.
 */

/**
 * Is this the physical "A" key, whatever character the layout makes of it?
 *
 * @param _event a keydown event
 * @return {boolean}
 */
export function isPhysicalAKey(_event : KeyboardEvent) : boolean
{
	// code is the layout-independent answer and is what should normally decide
	if(_event.code)
	{
		return _event.code === "KeyA";
	}

	// ... but it is absent on synthetic events (the grid replays navigation keys as bare
	// KeyboardEvents) and on some virtual keyboards, so fall back to the character
	return _event.key === "a" || _event.key === "A";
}
