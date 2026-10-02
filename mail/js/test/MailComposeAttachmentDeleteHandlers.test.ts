import {assert} from "@open-wc/testing";
import * as sinon from "sinon";
import {MailCompose} from "../compose";
import type {MailApp} from "../app";
import {Et2Dialog} from "../../../api/js/etemplate/Et2Dialog/Et2Dialog";

/**
 * Regression coverage for a real report (2026-09-15, relayed by ralf): "wenn man Anhänge die
 * schon hochgeladen sind in die zu verfassende E-Mail wieder rauslöschen möchte dreht sich nur
 * das Rad" (deleting an already-uploaded attachment just spins forever) - for both a brand new
 * compose's own upload and a forwarded message's carried-over attachments.
 *
 * Root cause (corrected 2026-10-02, see _wireAttachmentDeleteHandlers()'s docblock): et2 calls
 * every onclick as (event, widget), deleteAttachment() took the widget only, got the event, missed
 * the `delete[...]` id and returned true - ButtonMixin._handleClick() then submits the popup's form,
 * which JMAP mode has nothing server-side left to handle, hence the endless spinner. The original
 * diagnosis (a set_value()-rebuilt row's onclick string never resolves) was wrong: rebuilt rows
 * resolve it like the initial render does. _wireAttachmentDeleteHandlers() hid the bug for
 * rebuilt rows only; a mail_compose_prepare hook's attachments (initial content) kept hanging.
 *
 * Setup: a fake `attachments` grid widget whose OWN set_value() throws away and recreates a fresh
 * row widget object with a no-op onclick every time it's called, so a passing test proves
 * _wireAttachmentDeleteHandlers() is what re-wires each row, not just a one-time fluke.
 */

const egw : any = {
	lang : (label : string, ...args : string[]) =>
	{
		let i = 0;
		return String(label).replace(/%(\d+)/g, () => args[i++] ?? '');
	},
};

function createFakeApp() : MailApp
{
	return {egw} as unknown as MailApp;
}

/** A no-op onclick, matching what an UNRESOLVED onclick="..." string attribute leaves behind - always "allows" the click through (returns true), same as Et2Widget._handleClick()'s own fallback. */
function unresolvedOnclick() : boolean
{
	return true;
}

function createFakeEt2()
{
	const rowWidgets : Record<string, any> = {};
	const summaryNameWidget = {value : '', set_value(v : any) { this.value = v; }};
	const moreTextWidget = {value : '', set_value(v : any) { this.value = v; }};
	const uploadSectionWidget = {disabled : false, set_disabled(v : boolean) { this.disabled = v; }};
	const detailsWidget : any = {
		disabled : false, title : '',
		set_disabled(v : boolean) { this.disabled = v; },
		getParent : () => uploadSectionWidget,
		getChildren : () => [],
	};
	const attachmentsWidget = {
		set_value({content} : {content : any[]})
		{
			// Mimic the real bug: every set_value() rebuilds each row from scratch - a fresh
			// widget object, onclick reset to unresolved, discarding whatever was wired before.
			for(const key of Object.keys(rowWidgets))
			{
				delete rowWidgets[key];
			}
			for(const attachment of content || [])
			{
				rowWidgets[`delete[${attachment.tmp_name}]`] = {id : `delete[${attachment.tmp_name}]`, onclick : unresolvedOnclick};
			}
		},
		getParent : () => detailsWidget,
	};

	let content : any = {data : {attachments : []}, getEntry(key : string) { return this.data[key]; }};

	return {
		getArrayMgr : (_name : string) => content,
		setArrayMgr : (_name : string, mgr : any) => { content = mgr; },
		getWidgetById : (id : string) =>
		{
			if(id === 'attachments') return attachmentsWidget;
			if(id === 'attachmentsSummaryName') return summaryNameWidget;
			if(id === 'attachmentsMoreText') return moreTextWidget;
			return rowWidgets[id];
		},
		rowWidgets, detailsWidget, uploadSectionWidget,
	};
}

function createCompose()
{
	const compose = Object.create(MailCompose.prototype) as any;
	compose.app = createFakeApp();
	const et2 = createFakeEt2();
	compose.et2 = et2;
	return {compose, et2};
}

/** Simulates a real click: calls the row widget's CURRENT onclick, exactly as Et2Widget._handleClick() would. */
function clickDeleteButton(et2 : ReturnType<typeof createFakeEt2>, tmpName : string) : boolean
{
	const widget = et2.rowWidgets[`delete[${tmpName}]`];
	return widget.onclick(new Event('click'), widget);
}

describe("MailCompose attachment delete buttons stay clickable after set_value() rebuilds rows", () =>
{
	afterEach(() =>
	{
		sinon.restore();
	});

	it("mergeAttachmentEntries() wires a working delete handler for the newly merged row", () =>
	{
		const {compose, et2} = createCompose();
		(compose as any).isJmapMode = true;
		(compose as any).warnAttachmentSizeLimit = () => {};

		(compose as any).mergeAttachmentEntries([{tmp_name : 'tmp-1', name : 'a.txt', size : 10}]);

		const clickResult = clickDeleteButton(et2, 'tmp-1');

		assert.isFalse(clickResult, "the click must be cancelled (no form submit), not fall through to a real submit");
		assert.deepEqual(et2.getArrayMgr('content').data.attachments, [], "the attachment must actually be removed");
	});

	it("deleting one attachment leaves the REMAINING ones still clickable (not stuck after the first delete)", () =>
	{
		const {compose, et2} = createCompose();
		(compose as any).isJmapMode = true;
		(compose as any).warnAttachmentSizeLimit = () => {};

		(compose as any).mergeAttachmentEntries([
			{tmp_name : 'tmp-1', name : 'a.txt', size : 10},
			{tmp_name : 'tmp-2', name : 'b.txt', size : 20},
		]);

		assert.isFalse(clickDeleteButton(et2, 'tmp-1'), "first delete must be cancelled, not fall through to a submit");
		assert.deepEqual(
			et2.getArrayMgr('content').data.attachments.map((a : any) => a.tmp_name), ['tmp-2'],
			"only the clicked attachment should be removed"
		);

		// tmp-2's row was rebuilt by deleteAttachment()'s own set_value() call above - its OWN
		// delete button must have been re-wired too, or clicking it next would hit the exact same
		// endless-spinner bug this whole fix exists for.
		assert.isFalse(clickDeleteButton(et2, 'tmp-2'), "second delete must ALSO be cancelled, not fall through to a submit");
		assert.deepEqual(et2.getArrayMgr('content').data.attachments, [], "both attachments should now be gone");
	});

	it("checkSharingFilemode()'s own set_value() call also re-wires delete handlers", () =>
	{
		const {compose, et2} = createCompose();
		(compose as any).isJmapMode = true;
		(compose as any).warnAttachmentSizeLimit = () => {};
		(compose as any).mergeAttachmentEntries([{tmp_name : 'tmp-1', name : 'a.txt', size : 10}]);

		// checkSharingFilemode() reads/writes several other widgets too - stub the ones this test
		// doesn't care about so only the attachments-rewiring behaviour is under test here.
		sinon.stub(Et2Dialog, "alert").resolves([0, {}] as any);
		const filemodeWidget = {
			value : 'share_ro', select_options : [],
			get_value() { return this.value; }, set_value(v : any) { this.value = v; },
		};
		const readonlyStub = {set_readonly() {}, set_suggest() {}};
		const originalGetWidgetById = et2.getWidgetById;
		(et2 as any).getWidgetById = (id : string) =>
		{
			if(id === 'filemode') return filemodeWidget;
			if(id === 'expiration' || id === 'password') return readonlyStub;
			return originalGetWidgetById(id);
		};
		(compose as any).et2 = et2;
		(compose as any).app = {egw : {...egw, app : () => false}};

		(compose as any).checkSharingFilemode({}, filemodeWidget);

		assert.isFalse(clickDeleteButton(et2, 'tmp-1'), "delete must still be cancelled after a filemode-triggered rebuild");
		assert.deepEqual(et2.getArrayMgr('content').data.attachments, []);
	});

	it("a filemode pick after a client-side attach counts as explicit, even though the compose opened without attachments", () =>
	{
		// found live 2026-09-16 on production: the server sets no_griddata for a compose opened
		// without attachments, checkSharingFilemode() returns right away while it is set, so a
		// real "Download link" pick never set explicitShareModeChosen and the files went out as
		// plain attachments
		const {compose, et2} = createCompose();
		(compose as any).isJmapMode = true;
		(compose as any).warnAttachmentSizeLimit = () => {};
		et2.getArrayMgr('content').data.no_griddata = true;
		(compose as any).mergeAttachmentEntries([{tmp_name : 'tmp-1', name : 'a.txt', size : 10}]);
		assert.isFalse(et2.getArrayMgr('content').getEntry('no_griddata'));

		sinon.stub(Et2Dialog, "alert").resolves([0, {}] as any);
		const filemodeWidget = {
			value : 'link', select_options : [],
			get_value() { return this.value; }, set_value(v : any) { this.value = v; },
		};
		const readonlyStub = {set_readonly() {}, set_suggest() {}};
		const originalGetWidgetById = et2.getWidgetById;
		(et2 as any).getWidgetById = (id : string) =>
		{
			if(id === 'filemode') return filemodeWidget;
			if(id === 'expiration' || id === 'password') return readonlyStub;
			return originalGetWidgetById(id);
		};
		(compose as any).app = {egw : {...egw, app : () => false}};

		(compose as any).checkSharingFilemode({}, filemodeWidget);
		assert.isTrue((compose as any).explicitShareModeChosen, "a real pick must be remembered for currentEmailFields()");

		assert.isFalse(clickDeleteButton(et2, 'tmp-1'));
		assert.isTrue(et2.getArrayMgr('content').getEntry('no_griddata'), "removing the last attachment restores the empty state");
	});

	it("a row rendered with the initial content (prepare-hook attachment) deletes through the template's own onclick", () =>
	{
		// found live 2026-10-02: an achelper template mail's attachment is in the popup's initial
		// content, so its row is never rebuilt/re-wired - the button keeps the template-resolved
		// `onclick="app.mail.compose.deleteAttachment"` (the bound method, see
		// et2_compileLegacyJS()), which Et2Widget._handleClick() calls as (event, widget)
		const {compose, et2} = createCompose();
		(compose as any).isJmapMode = true;
		const path = 'vfs://default/apps/acilog/123/bill.pdf';
		et2.getArrayMgr('content').data.attachments = [{tmp_name : path, name : 'bill.pdf', size : 10}];
		const widget = {id : `delete[${path}]`, onclick : compose.deleteAttachment.bind(compose)};
		et2.rowWidgets[widget.id] = widget;

		assert.isFalse(widget.onclick(new Event('click'), widget), "the click must be cancelled, not submit the form");
		assert.deepEqual(et2.getArrayMgr('content').data.attachments, [], "the attachment must actually be removed");
	});

	it("an unrecognised button never falls through to the (dead) form submit in JMAP mode", () =>
	{
		const {compose} = createCompose();
		(compose as any).isJmapMode = true;
		assert.isFalse(compose.deleteAttachment(new Event('click'), {id : 'something-else'}));
	});

	it("documents the ORIGINAL bug: an unresolved onclick lets the click fall through instead of cancelling it", () =>
	{
		// No _wireAttachmentDeleteHandlers() call at all here - just the raw set_value() rebuild,
		// same as the pre-fix code path.
		const et2 = createFakeEt2();
		et2.getWidgetById('attachments').set_value({content : [{tmp_name : 'tmp-1'}]});

		const clickResult = clickDeleteButton(et2, 'tmp-1');

		assert.isTrue(clickResult, "an unresolved onclick returns true (nothing cancelled), which is exactly what used to fall through to a real form submit");
	});
});
