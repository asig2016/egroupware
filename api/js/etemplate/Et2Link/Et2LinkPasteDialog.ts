import {Et2VfsSelectDialog} from "../Et2Vfs/Et2VfsSelectDialog";
import {css, html, TemplateResult} from "lit";
import {SearchResult} from "../Et2Widget/SearchMixin";

/**
 * Select files from the file clipboard to paste
 */
export class Et2LinkPasteDialog extends Et2VfsSelectDialog
{
	static get styles()
	{
		return [
			...super.styles,
			css`
				/* Hide the unwanted stuff */

				#toolbar, #path {
					display: none;
				}
			`
		];
	}

	constructor()
	{
		super();
		this.searchUrl = "";
		this.multiple = true;
		this._appList = [];
	}

	protected async localSearch<DataType extends SearchResult>(search : string, searchOptions : object, localOptions : DataType[] = []) : Promise<DataType[]>
	{
		const files = await getClipboardFiles();

		// We don't care if they're directories, treat them all as files (no double click, all selectable)
		files.forEach(f => f.isDir = false);

		return super.localSearch(search, searchOptions, files);
	}


	protected noResultsTemplate() : TemplateResult
	{
		return html`
            <div class="search__empty vfs_select__empty">
                <et2-image src="filemanager"></et2-image>
                ${this.egw().lang("clipboard is empty!")}
            </div>`;
	}
}

/**
 * Get any files that are in the system clipboard
 *
 * @return {string[]} Paths
 */
export async function getClipboardFiles()
{
	let clipboard_files = [];
	if(typeof window.egw.getSessionItem('phpgwapi', 'egw_clipboard') != 'undefined')
	{
		let clipboard = JSON.parse(window.egw.getSessionItem('phpgwapi', 'egw_clipboard')) || {
			type: [],
			selected: []
		};
		for(let i = 0; i < clipboard.selected.length; i++)
		{
			let split = clipboard.selected[i].id.split('::');
			const app = split.shift();
			if(app == 'filemanager')
			{
				const data = clipboard.selected[i].data ?? {};
				clipboard_files.push({
					value: clipboard.selected[i].id,
					app: app,
					id: split.join("::"),
					name: data.name ?? clipboard.selected[i].id,
					mime: data.mime,
					isDir: data.is_dir ?? false,
					path: data.path ?? split.join("::"),
					downloadUrl: data.download_url
				});
			}
			else
			{
				clipboard_files.push({
					value: clipboard.selected[i].id,
					app: app,
					id: split.join("::"),
					path: clipboard.selected[i].id,
					name: await window.egw().link_title(app, split.join("::"), true),
					mime: `egroupware/${app}`,
					icon: window.egw().image("navbar", app),
					symlink: true
				});
			}
		}
	}
	return clipboard_files;
}

customElements.define("et2-link-paste-dialog", Et2LinkPasteDialog);