import {assert, fixture, html} from "@open-wc/testing";
import * as sinon from "sinon";
import {setupEgwFrameworkTests} from "./EgwFrameworkTestSetup"
import '../EgwFramework';
import {EgwFramework} from '../EgwFramework';
import {EgwFrameworkApp} from '../EgwFrameworkApp';

// Create common stubs that will be used across tests
const egwStub = {
	window: {
		opener: null,
		egw_ready: Promise.resolve(),
		framework: null
	},
	lang: sinon.stub().callsFake(t => t),
	// no user, no session tabs to restore
	user: sinon.stub().returns({}),
	getSessionItem: sinon.stub().returns(null),
	setSessionItem: sinon.stub(),
	preference: sinon.stub().resolves(""),
	set_preference: sinon.stub(),
	add_timer: sinon.stub(),
	link_quick_add: sinon.stub(),
	onLogout_timer: sinon.stub().resolves(),
	open_link: sinon.stub(),
	registerJSONPlugin: sinon.stub()
};

describe('EgwFramework', () =>
{
	setupEgwFrameworkTests();
	let element : EgwFramework;
	let sandbox : sinon.SinonSandbox;

	beforeEach(async() =>
	{
		sandbox = sinon.createSandbox();
		// Replace global egw with our stub
		(window as any).egw = egwStub;

		element = await fixture(html`
            <egw-framework>
                <div slot="header">Header content</div>
                <div slot="status">Status content</div>
            </egw-framework>
		`);
	});

	afterEach(() =>
	{
		sandbox.restore();
	});

	// Make sure it works
	it("renders", async() =>
	{
		assert.ok(element);
		assert.instanceOf(element, EgwFramework);
	});

	it('has correct default properties', () =>
	{
		assert.equal(element.layout, 'default');
		assert.isArray(element.applicationList);
		assert.isEmpty(element.applicationList);
	});

	it('loads an app correctly', async() =>
	{
		// Setup test data
		const testApp = {
			name: 'test-app',
			internalName: 'test',
			url: 'https://test.app',
			title: 'Test App',
			icon: 'https://test.app/icon.png',
			status: '1',
			features: {}
		};
		element.applicationList = [testApp];

		// Test loading the app
		const app = element.loadApp('test-app', true);

		assert.instanceOf(app, EgwFrameworkApp);
		assert.equal(app.getAttribute('name'), 'test');
		assert.equal(app.getAttribute('id'), 'test-app');
		assert.equal(app.url, 'https://test.app');
		assert.equal(app.title, 'Test App');
		assert.isTrue(app.hasAttribute('active'));
	});

	it('handles message plugin registration', async() =>
	{
		await element.getEgwComplete();

		assert.isTrue(egwStub.registerJSONPlugin.calledOnce);

		// Get the handler function that was registered
		const handler = egwStub.registerJSONPlugin.firstCall.args[0];

		// Test successful message handling
		assert.isTrue(handler('message', {
			data: {
				message: 'test message',
				type: 'info'
			}
		}));

		// Test error handling
		assert.throws(() =>
		{
			handler('message', {data: {}});
		}, 'Invalid parameters');
	});

	it('loads hidden apps on first update', async() =>
	{
		const hiddenApp = {
			name: 'status',
			status: '5',
			url: 'https://test.app/status'
		};
		element.applicationList = [hiddenApp];

		await element.updateComplete;

		const app = element.querySelector('egw-app[name="status"]');
		assert.exists(app);
		assert.equal(app.getAttribute('id'), 'status');
	});

	it('gets application by name', () =>
	{
		const app = document.createElement('egw-app');
		app.setAttribute('name', 'test-app');
		element.appendChild(app);

		const found = element.getApplicationByName('test-app');
		assert.equal(found, app);
	});

	it('properly handles menuaction generation', () =>
	{
		const result = element.getMenuaction(
			'test',
			'menuaction=app.handler.method',
			'home'
		);

		// leading app must be the target app of the menuaction, not the hosting tab ('home')
		assert.equal(
			result,
			'app.kdots_framework.test.template.app.handler.method'
		);
	});

	it('falls back to given appName when there is no target menuaction', () =>
	{
		const result = element.getMenuaction('test', null, 'home');

		assert.equal(
			result,
			'home.kdots_framework.test.template'
		);
	});

	// openPopup() on a narrow screen opens an Et2Dialog instead of a window and closes it
	// on sl-after-hide.  Shoelace widgets inside the popup (et2-email's dropdown, a select,
	// ...) bubble the same event, and used to close the whole popup while it was rendering.
	it('keeps an in-page popup open when a widget inside it fires sl-after-hide', async() =>
	{
		element.applicationList = [{
			name: 'test-app', internalName: 'test', url: 'https://test.app', title: 'Test App',
			icon: '', status: '1', features: {}
		}];
		element.loadApp('test-app', true);
		sandbox.stub(window, 'matchMedia').returns(<MediaQueryList><unknown>{matches: true});
		(window as any).app = {};

		// Stand-in for the Et2Dialog egw.openDialog() would create
		const dialog = Object.assign(document.createElement('div'), {
			updateComplete: Promise.resolve(true),
			modal: {activate: sinon.stub(), deactivate: sinon.stub()},
			close: sinon.stub()
		});
		(egwStub as any).openDialog = sinon.stub().resolves(dialog);

		await element.openPopup('index.php?menuaction=test.test_ui.edit', 400, 300, 'test_edit', 'test', false, 'no');
		await dialog.updateComplete;

		const child = document.createElement('div');
		dialog.append(child);
		child.dispatchEvent(new CustomEvent('sl-after-hide', {bubbles: true, composed: true}));
		child.dispatchEvent(new CustomEvent('sl-request-close', {bubbles: true, composed: true}));
		assert.isFalse(dialog.close.called, "a child's sl-after-hide / sl-request-close must not close the popup");

		dialog.dispatchEvent(new CustomEvent('sl-after-hide', {bubbles: true}));
		assert.isTrue(dialog.close.calledOnce, "the dialog's own sl-after-hide closes the popup");
	});
});