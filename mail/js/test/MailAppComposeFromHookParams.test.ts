import {assert} from "@open-wc/testing";
// both of these have to come before "../app" - see MailAppImportStub's own docblock
import "./MailAppImportStub";
import "../../../api/js/etemplate/Et2Widget/Et2Widget";
import {MailApp} from "../app";

/**
 * PATCH CORE: MailApp.composeFromHookParams() - an app's own dialog (achelper's "Create email from
 * template") starting a compose with mail_compose_prepare hook params. On a narrow top-level window it
 * opens the phone's inline compose dialog (openComposeDialog()) with those params, so the hook fills it;
 * anywhere else it does nothing and answers false, and the caller opens /mail/compose.php as before.
 */

function createMailApp()
{
	const app = Object.create(MailApp.prototype) as MailApp;
	const dialogCalls : any[] = [];

	Object.assign(app, {
		egw: {
			lang: (label : string) => label,
			preference: (name : string, app : string) => name === 'ActiveProfileID' && app === 'mail' ? '7' : undefined,
		},
		openComposeDialog: async(settings : any, accId : string, hookParams : any) => void dialogCalls.push({settings, accId, hookParams}),
	});

	return {app, dialogCalls};
}

describe("MailApp.composeFromHookParams()", () =>
{
	let originalMatchMedia;
	let originalOpener;

	beforeEach(() =>
	{
		originalMatchMedia = window.matchMedia;
		originalOpener = window.opener;
	});

	afterEach(() =>
	{
		window.matchMedia = originalMatchMedia;
		Object.defineProperty(window, 'opener', {value: originalOpener, configurable: true});
	});

	it("opens the inline dialog with the hook params on a narrow top-level window", () =>
	{
		//@ts-ignore
		window.matchMedia = () => ({matches: true});
		Object.defineProperty(window, 'opener', {value: null, configurable: true});
		const {app, dialogCalls} = createMailApp();
		const params = {mode: 'actemplate', template: '53', infolog_id: '270708', acc_id: '72'};

		assert.isTrue(app.composeFromHookParams(params));

		assert.lengthOf(dialogCalls, 1);
		assert.deepEqual(dialogCalls[0].settings, {id: '', from: ''}, "a new mail, no source message");
		assert.strictEqual(dialogCalls[0].accId, '72', "the account the params name");
		assert.deepEqual(dialogCalls[0].hookParams, params, "the hook gets the params as they are");
	});

	it("takes the given account first, else the active profile", () =>
	{
		//@ts-ignore
		window.matchMedia = () => ({matches: true});
		Object.defineProperty(window, 'opener', {value: null, configurable: true});
		const {app, dialogCalls} = createMailApp();

		app.composeFromHookParams({mode: 'actemplate', acc_id: '72'}, '5');
		app.composeFromHookParams({mode: 'actemplate'});

		assert.deepEqual(dialogCalls.map(c => c.accId), ['5', '7']);
	});

	it("does nothing on a wide window or in a popup window - the caller opens compose.php", () =>
	{
		const {app, dialogCalls} = createMailApp();

		//@ts-ignore
		window.matchMedia = () => ({matches: false});
		Object.defineProperty(window, 'opener', {value: null, configurable: true});
		assert.isFalse(app.composeFromHookParams({mode: 'actemplate'}), "wide");

		//@ts-ignore
		window.matchMedia = () => ({matches: true});
		Object.defineProperty(window, 'opener', {value: window, configurable: true});
		assert.isFalse(app.composeFromHookParams({mode: 'actemplate'}), "a popup window");

		assert.lengthOf(dialogCalls, 0);
	});
});
