import {assert} from "@open-wc/testing";
import "./FilemanagerAppImportStub";
// breaks the et2_core_widget <-> Et2Widget import cycle (ClassWithAttributes TDZ) the same
// way the other app.ts tests do, before app.ts pulls it in transitively
import "../../../api/js/etemplate/Et2Widget/Et2Widget";

/**
 * app.ts has to be loaded through its explicit source path - see the note in
 * FilemanagerMailAttachments.test.ts.
 */
const APP_SOURCE = '/filemanager/js/app.ts';

/**
 * Which list a new folder goes to.
 *
 * app.filemanager is one object for every filemanager template in the window: the app's own tab
 * and the Files tab of an entry in another app (an et2-app-box hosting filemanager.index). Its
 * `nm` and `et2` are those of the template loaded last. handlePathChange() applied the new folder
 * to `this.nm`, so a link opening the filemanager on a folder (linkHandler() -> change_dir())
 * changed the path widget of the filemanager tab but filtered the other list: the tab showed the
 * new path above the rows of the previous folder.
 *
 * Setup: a bare Object.create(prototype) with two stub templates, as in the filedrop test - the
 * methods only touch path_widget, et2/nm and the widgets' getInstanceManager().
 */
describe('filemanagerAPP: a new folder goes to the list of its own path widget', () =>
{
	let filemanagerAppClass : any;

	before(async function()
	{
		this.timeout(15000);
		await import(APP_SOURCE);
		filemanagerAppClass = (<any>window).app.classes.filemanager;
	});

	const template = (id : string, content : any = {}) =>
	{
		const nm = {applied: [] as any[], applyFilters(filters) { this.applied.push(filters); }};
		const upload = {path: ''};
		const container = {
			getWidgetById: (name : string) => ({nm, upload}[name] ?? null),
			getArrayMgr: () => ({getEntry: (key : string) => content[key]}),
		};
		const instance = {uniqueId: id, widgetContainer: container};
		let value = '/old';
		const path = {
			getInstanceManager: () => instance,
			getValue: () => value,
			get_value: () => value,
			set_value: (v : string) => { value = v; },
			dispatchEvent: () => true,
		};
		return {id, nm, upload, container, path};
	};

	it('handlePathChange() filters the list of the path widget\'s template, not the one loaded last', () =>
	{
		const own = template('filemanager-index');
		const other = template('acilog-edit_appbox');
		const app = Object.create(filemanagerAppClass.prototype);
		app.nm = other.nm;
		app.et2 = other.container;
		own.path.set_value('/apps/acilog/1/IC');

		app.handlePathChange(new Event('change'), own.path);

		assert.deepEqual(own.nm.applied, [{col_filter: {dir: '/apps/acilog/1/IC'}}]);
		assert.deepEqual(other.nm.applied, [], 'the other list keeps its folder');
		assert.equal(own.upload.path, '/apps/acilog/1/IC/');
		assert.equal(other.upload.path, '');
	});

	it('handlePathChange() leaves the upload of a hidden-upload share alone, in the path widget\'s template', () =>
	{
		const own = template('filemanager-index', {hidden_upload: true});
		const other = template('acilog-edit_appbox');
		const app = Object.create(filemanagerAppClass.prototype);
		app.nm = other.nm;
		app.et2 = other.container;
		own.path.set_value('/apps/acilog/1/IC');

		app.handlePathChange(new Event('change'), own.path);

		assert.deepEqual(own.nm.applied, [{col_filter: {dir: '/apps/acilog/1/IC'}}]);
		assert.equal(own.upload.path, '');
		assert.equal(other.upload.path, '');
	});

	it('change_dir() without a widget (a link) takes the filemanager tab, not the list registered first', () =>
	{
		const own = template('filemanager-index');
		const other = template('acilog-edit_appbox');
		const app = Object.create(filemanagerAppClass.prototype);
		app.et2 = other.container;
		app.path_widget = {'acilog-edit_appbox': other.path, 'filemanager-index': own.path};

		app.change_dir('/apps/acilog/1/IC');

		assert.equal(own.path.getValue(), '/apps/acilog/1/IC');
		assert.equal(other.path.getValue(), '/old');
	});
});
