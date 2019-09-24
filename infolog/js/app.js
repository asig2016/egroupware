/**
 * UI for Infolog
 *
 * @augments AppJS
 */
app.classes.infolog = acAppJS.extend({
	appname: 'infolog',
	loaded: [],
	changed: false,
	no_notifications: false,

	/**
	 * Constructor
	 *
	 * @memberOf app.infolog
	 */
	init: function ()
	{
		// call parent
		this._super.apply(this, arguments);
	},

	/**
	 * Destructor
	 */
	destroy: function ()
	{
		// call parent
		this._super.apply(this, arguments);
	},

	getVfsPath: function (_path) {
		return '/apps/' + _path.app2 + this.idToPath(_path.id2) + '/' + _path.id;
	},

	/**
	 * This function is called when the etemplate2 object is loaded
	 * and ready.  If you must store a reference to the et2 object,
	 * make sure to clean it up in destroy().
	 *
	 * @param {etemplate2} _et2 newly ready object
	 * @param {string} _name template name
	 */
	et2_ready: function (_et2, _name)
	{
		// call parent
		this._super.apply(this, arguments);

		switch (_name) {
			case 'infolog.index':
				this.filter_change();
				var nm = this.et2.getWidgetById('nm');

				//Modify nextmatch applyFilters so it executes our hook first
				nm.oldApply = nm.applyFilters;
				var newapply = function (_set) {
					var that = nm;

					// If called without filters to set, set active filters
					if (!_set)
						_set = that.activeFilters;

					if (typeof (that.activeFilters.search) == 'undefined')
						that.activeFilters.search = '';

					if (typeof (_set.search) == 'undefined')
						_set.search = that.activeFilters.search;

					// If same search, continue as usual
					if (_set.search == that.activeFilters.search) {
						that.oldApply(_set);
						app.infolog.initTree();
					} else {
						// If search changed, means user is trying to search Solr
						jQuery('#infolog-index .nextmatch_header_row > .search').after('<img src="pixelegg/images/loading.gif" class="loading_icon" />');

						// Call Solr
						egw.json('infolog.infolog_ajax.ajax_searchSolr', [_set], function (result) {
							jQuery('.loading_icon').remove();
							// Apply Query with additional search_ids
							that.oldApply(result);
							app.infolog.initTree();
						}).sendRequest(true);
					}
				};
				nm.applyFilters = newapply;

				var params = new URLSearchParams(window.location.search);
				var istab = params.get('istab');
				if (istab)
					window.setTimeout(function () {
						nm.dataview.updateColumns();
					}, 400);


				// Show / hide descriptions according to details filter
				var filter2 = nm.getWidgetById('filter2');
				this.show_details(filter2.getValue() == 'all', nm.getDOMNode(nm));
				// Remove the rule added by show_details() if the template is removed
				// jQuery(_et2.DOMContainer).on('clear', jQuery.proxy(function() {egw.css(this);}, '#' + nm.getDOMNode(nm).id + ' .et2_box.infoDes'));

				// Enable decrypt on hover
				if (this.egw.user('apps').stylite)
				{
					this._get_stylite(function () {
						this.mailvelopeAvailable(function () {
							app.stylite.decrypt_hover(nm);
						});
					});
				}

				// fkar start
				if (!egwIsMobile()) {
					this.hideAllFilters();
					//Change 'Search' placeholder to 'Search in Solr'
					jQuery('#infolog-index_search input[name=search]').attr('placeholder', 'Search in Solr');
					// Initialize Unread Filters tree
					this.initTree();
					// Define events on nextmatch refresh
					// jQuery('[name^=col_filter],[name=filter],[name=cat_id],input[name=search],#infolog-index_nm table.egwGridView_outer > thead .et2_selectbox ').change( function() {
					// app.infolog.initTree();
					// });
					jQuery('span#favorite_sidebox_infolog li').click(function () {
						//Reset string ids
						var nm = app.infolog.et2.getWidgetById('nm');
						if (nm.activeFilters)
							nm.activeFilters['col_filter']['string_ids'] = '';
					});
				}

				// fkar end
				break;
			case 'infolog.edit.print':
				if (this.et2.getArrayMgr('content').data.info_des.indexOf(this.begin_pgp_message) != -1)
				{
					this.mailvelopeAvailable(this.printEncrypt);
				} else
				{
					// Trigger print command if the infolog oppend for printing purpose
					this.infolog_print_preview_onload();
				}
				break;
			case 'infolog.edit':

				this.set_days_open('', '');
				//infologInit(); //init our custom required checks
				window.tree_initialized = false;
				window.activity_initialized = false;
				if (jQuery(".et2_tabflag:contains('Activity Card')").hasClass('active')) {
					app.infolog.loadAcTree();
				}
				jQuery(".et2_tabflag:contains('Activity Card')").click(function () {
					app.infolog.loadAcTree();
				});
				//fkar
				this.initDisabled();
				//aseim for activity card, should run when template is loaded (via ajax?)
				//activityInit();
				//end aseim

				// Init title
				var id = this.et2.getWidgetById('info_number').node.textContent;
				egw.json('infolog.infolog_ajax.ajax_getDocumentTitle', [id], function (result) {
					document.title = result;
				}).sendRequest(true);
				//fkar load iframe if active page
				setTimeout(function () {
					jQuery("#infolog-edit_tabs .et2_tabheader span.et2_tabflag.active").each(function () {
						app.infolog.changeTab(this, true)
					});
				}, 1000);
				//fkar load iframes when tab is clicked
				jQuery("#infolog-edit_tabs .et2_tabheader span.et2_tabflag").click(function (e) {
					app.infolog.changeTab(this, false)
				});
				jQuery("#infolog-edit_tabs .et2_tabheader span.et2_tabflag").dblclick(function (e) {
					app.infolog.changeTab(this, true)
				});

				// Before loading fixate window height
				var h = jQuery('#infolog-edit div.et2_tabs').innerHeight();
				jQuery('#infolog-edit_infolog-edit-links').css('height', h + 'px');
				jQuery('#infolog-edit_infolog-edit-acreport').css('height', h + 'px');
				jQuery('#infolog-edit_infolog-edit-activitycard').css('height', h + 'px');

				// Change flag
				jQuery('#infolog-edit').change(function () {
					if (!app.infolog.changed)
						app.infolog.changed = true;
				});
				// Add message for unsaved infolog
				window.onbeforeunload = function (e) {
					var value = app.infolog.et2.getWidgetById('info_number').options.value;
					if (!value || app.infolog.changed) {
						var dialogText = 'Confirm exit';
						e.returnValue = dialogText;
						return dialogText;
					}
				}
				break;
		}
	},

	/**
	 * Observer method receives update notifications from all applications
	 *
	 * InfoLog currently reacts to timesheet updates, as it might show time-sums.
	 * @todo only trigger update, if times are shown
	 *
	 * @param {string} _msg message (already translated) to show, eg. 'Entry deleted'
	 * @param {string} _app application name
	 * @param {(string|number)} _id id of entry to refresh or null
	 * @param {string} _type either 'update', 'edit', 'delete', 'add' or null
	 * - update: request just modified data from given rows.  Sorting is not considered,
	 *		so if the sort field is changed, the row will not be moved.
	 * - edit: rows changed, but sorting may be affected.  Requires full reload.
	 * - delete: just delete the given rows clientside (no server interaction neccessary)
	 * - add: requires full reload for proper sorting
	 * @param {string} _msg_type 'error', 'warning' or 'success' (default)
	 * @param {object|null} _links app => array of ids of linked entries
	 * or null, if not triggered on server-side, which adds that info
	 */
	observer: function (_msg, _app, _id, _type, _msg_type, _links)
	{
		//fkar start
		// Refresh Unread filters tree every time nm refreshes
		if (_app == 'infolog') {
			this.initTree();
			this.latest_infolog = _id;
		}

		//fkar end
		if (typeof _links != 'undefined')
		{
			if (typeof _links.infolog != 'undefined')
			{
				switch (_app)
				{
					case 'timesheet':
						var nm = this.et2 ? this.et2.getWidgetById('nm') : null;
						if (nm)
							nm.applyFilters();
						break;
				}
			}
		}
		// Refresh handler for Addressbook CRM view
		if (_app == 'infolog' && this.et2.getInstanceManager() && this.et2.getInstanceManager().app == 'addressbook' && this.et2.getInstanceManager().name == 'infolog.index')
		{
			this.et2._inst.refresh(_msg, _app, _id, _type);
		}

	},

	/**
	 * Retrieve the current state of the application for future restoration
	 *
	 * Reimplemented to add action/action_id from content set by server
	 * when eg. viewing infologs linked to contacts.
	 *
	 * @return {object} Application specific map representing the current state
	 */
	getState: function ()
	{
		// call parent
		var state = this._super.apply(this, arguments);
		var nm = {};

		// Get index etemplate
		var et2 = etemplate2.getById('infolog-index');
		if (et2)
		{
			var content = et2.widgetContainer.getArrayMgr('content');
			nm = content && content.data && content.data.nm ? content.data.nm : {};
		}

		state.action = nm.action || null;
		state.action_id = nm.action_id || null;

		return state;
	},

	/**
	 * Set the application's state to the given state.
	 *
	 * Reimplemented to also reset action/action_id.
	 *
	 * @param {{name: string, state: object}|string} state Object (or JSON string) for a state.
	 *	Only state is required, and its contents are application specific.
	 *
	 * @return {boolean} false - Returns false to stop event propagation
	 */
	setState: function (state)
	{
		// as we have to set state.state.action, we have to set all other
		// for "No filter" favorite to work as expected
		var to_set = {col_filter: null, filter: '', filter2: '', cat_id: '', search: '', action: null};
		if (typeof state.state == 'undefined')
			state.state = {};
		for (var name in to_set)
		{
			if (typeof state.state[name] == 'undefined')
				state.state[name] = to_set[name];
		}
		return this._super.apply(this, arguments);
	},

	/**
	 * Enable or disable the date filter
	 *
	 * If the filter is set to something that needs dates, we enable the
	 * header_left template.  Otherwise, it is disabled.
	 */
	filter_change: function ()
	{
		var filter = this.et2.getWidgetById('filter');
		var nm = this.et2.getWidgetById('nm');
		var dates = this.et2.getWidgetById('infolog.index.dates');
		if (nm && filter)
		{
			switch (filter.getValue())
			{
				case 'bydate':
				case 'duedate':

					if (filter && dates)
					{
						dates.set_disabled(false);
						jQuery(this.et2.getWidgetById('startdate').getDOMNode()).find('input').focus();
					}
					break;
				default:
					if (dates)
					{
						dates.set_disabled(true);
					}
					break;
			}
		}
	},

	/**
	 * show or hide the details of rows by selecting the filter2 option
	 * either 'all' for details or 'no_description' for no details
	 *
	 * @param {Event} event Change event
	 * @param {et2_nextmatch} nm The nextmatch widget that owns the filter
	 */
	filter2_change: function (event, nm)
	{
		var filter2 = nm.getWidgetById('filter2');

		if (nm && filter2)
		{
			// Show / hide descriptions
			this.show_details(filter2.getValue() == 'all', nm.getDOMNode(nm));
		}
		// fkar
		// Temporarily disable changing columns
		// This is supported by egw, but right now it forces a reload without actually doing something
		return true;

		// Only change columns for a real user event, to avoid interfering with
		// favorites
		if (nm && filter2 && !nm.update_in_progress)
		{
			// Store selection as implicit preference
			egw.set_preference('infolog', nm.options.settings.columnselection_pref.replace('-details', '') + '-details-pref', filter2.value);

			// Change preference location - widget is nextmatch
			nm.options.settings.columnselection_pref = nm.options.settings.columnselection_pref.replace('-details', '') + (filter2.value == 'all' ? '-details' : '');

			// Load new preferences
			var colData = nm.columns.slice();
			for (var i = 0; i < nm.columns.length; i++)
				colData[i].visible = false;

			if (egw.preference(nm.options.settings.columnselection_pref, 'infolog'))
			{
				nm.set_columns(egw.preference(nm.options.settings.columnselection_pref, 'infolog').split(','));
			}
			nm._applyUserPreferences(nm.columns, colData);

			// Now apply them to columns
			for (var i = 0; i < colData.length; i++)
			{
				nm.dataview.getColumnMgr().columns[i].set_width(colData[i].width);
				nm.dataview.getColumnMgr().columns[i].set_visibility(colData[i].visible);
			}
			nm.dataview.getColumnMgr().updated = true;
			// Update page
			nm.dataview.updateColumns();
		}
	},

	/**
	 * Show or hide details by changing the CSS class
	 *
	 * @param {boolean} show
	 * @param {DOMNode} dom_node
	 */
	show_details: function (show, dom_node)
	{
		// Show / hide descriptions
		// app.infolog.egw.css((dom_node && dom_node.id ? "#"+dom_node.id+' ' : '') + ".et2_box.infoDes","display:" + (show ? "block;" : "none;"));
		// fkar show/hide links
		// app.infolog.egw.css((dom_node && dom_node.id ? "#"+dom_node.id+' ' : '') + ".et2_box.linkboxheight","display:" + (show ? "block;" : "none;"));

		//fkar: old way with egw.css doesn't work with hidemenus since the selectors var gets reset and cannot find already existing rules
		// hide() and addClass() also don't work since the elements seem to refresh
		// Adding a style tag to header to keep the rules, and refreshing it each time we have a change

		var tag = jQuery('style.details_css');
		if (tag.length == 0)
			tag = jQuery('<style>').addClass('details_css').appendTo('head');

		var id = '';
		if (dom_node && dom_node.id)
			id = "#" + dom_node.id;

		var desc = id + " .show_details";
		if (show)
			var css = desc + ' { display: block; } ';
		else
			var css = desc + ' { display: none; } ';

		tag.html(css);

		if (egwIsMobile())
		{
			var $select = jQuery('.infoDetails');
			(show) ? $select.each(function (i, e) {
				jQuery(e).hide();
			}) : $select.each(function (i, e) {
				jQuery(e).show();
			});
		}
	},

	confirm_delete_2: function (_action, _senders)
	{
		var children = false;
		var child_button = jQuery('#delete_sub').get(0) || jQuery('[id*="delete_sub"]').get(0);
		if (child_button)
		{
			for (var i = 0; i < _senders.length; i++)
			{
				if (jQuery(_senders[i].iface.node).hasClass('infolog_rowHasSubs'))
				{
					children = true;
					break;
				}
			}
			child_button.style.display = children ? 'block' : 'none';
		}
		var callbackDeleteDialog = function (button_id)
		{
			if (button_id == et2_dialog.YES_BUTTON)
			{

			}
		};
		et2_dialog.show_dialog(callbackDeleteDialog, this.egw.lang("Do you really want to DELETE this Rule"), this.egw.lang("Delete"), {}, et2_dialog.BUTTONS_YES_NO_CANCEL, et2_dialog.WARNING_MESSAGE);
	},

	/**
	 * Confirm delete
	 * If entry has children, asks if you want to delete children too
	 *
	 *@param _action
	 *@param _senders
	 */
	confirm_delete: function (_action, _senders)
	{
		var children = false;
		var child_button = jQuery('#delete_sub').get(0) || jQuery('[id*="delete_sub"]').get(0);
		if (child_button)
		{
			for (var i = 0; i < _senders.length; i++)
			{
				if (jQuery(_senders[i].iface.getDOMNode()).hasClass('infolog_rowHasSubs'))
				{
					children = true;
					break;
				}
			}
			child_button.style.display = children ? 'block' : 'none';
		}
		nm_open_popup(_action, _senders);
	},

	/**
	 * Add email from addressbook
	 *
	 * @param ab_id
	 * @param info_cc
	 */
	add_email_from_ab: function (ab_id, info_cc)
	{
		var ab = document.getElementById(ab_id);

		if (!ab || !ab.value)
		{
			jQuery("tr.hiddenRow").css("display", "table-row");
		} else
		{
			var cc = document.getElementById(info_cc);

			for (var i = 0; i < ab.options.length && ab.options[i].value != ab.value; ++i)
				;

			if (i < ab.options.length)
			{
				cc.value += (cc.value ? ', ' : '') + ab.options[i].text.replace(/^.* <(.*)>$/, '$1');
				ab.value = '';
				ab.onchange();
				jQuery("tr.hiddenRow").css("display", "none");
			}
		}
		return false;
	},

	/**
	 * If one of info_status, info_percent or info_datecompleted changed --> set others to reasonable values
	 *
	 * @param {string} changed_id id of changed element
	 * @param {string} status_id
	 * @param {string} percent_id
	 * @param {string} datecompleted_id
	 */
	status_changed: function (changed_id, status_id, percent_id, datecompleted_id)
	{
		// Make sure this doesn't get executed while template is loading
		if (this.et2 == null || this.et2.getInstanceManager() == null)
			return;

		var status = document.getElementById(status_id);
		var percent = document.getElementById(percent_id);
		var datecompleted = document.getElementById(datecompleted_id + '[str]');
		if (!datecompleted)
		{
			datecompleted = jQuery('#' + datecompleted_id + ' input').get(0);
		}
		var completed;

		switch (changed_id)
		{
			case status_id:
				completed = status.value == 'done' || status.value == 'billed';
				if (completed || status.value == 'not-started' ||
						(status.value == 'ongoing') != (percent.value > 0 && percent.value < 100))
				{
					if (completed)
					{
						percent.value = 100;
					} else if (status.value == 'not-started')
					{
						percent.value = 0;
					} else if (!completed && (percent.value == 0 || percent.value == 100))
					{
						percent.value = 10;
					}
				}
				break;

			case percent_id:
				completed = percent.value == 100;
				if (completed != (status.value == 'done' || status.value == 'billed') ||
						(status.value == 'not-started') != (percent.value == 0))
				{
					status.value = percent.value == 0 ? (jQuery('[value="not-started"]', status).length ? 'not-started' : 'ongoing') : (percent.value == 100 ? 'done' : 'ongoing');
				}
				break;

			case datecompleted_id + '[str]':
			case datecompleted_id:
				completed = datecompleted.value != '';
				if (completed != (status.value == 'done' || status.value == 'billed'))
				{
					status.value = completed ? 'done' : 'not-started';
				}
				if (completed != (percent.value == 100))
				{
					percent.value = completed ? 100 : 0;
				}
				break;
		}
		if (!completed && datecompleted && datecompleted.value != '')
		{
			datecompleted.value = '';
		} else if (completed && datecompleted && datecompleted.value == '')
		{
			// todo: set current date in correct format
		}
	},

	/**
	 * handle "print" action from "Actions" selectbox in edit infolog window.
	 * check if the template is dirty then submit the template otherwise just open new window as print.
	 *
	 */
	edit_actions: function ()
	{
		var widget = this.et2.getWidgetById('action');
		var template = this.et2._inst;
		if (template)
		{
			var id = template.widgetContainer.getArrayMgr('content').data['info_id'];
		}
		if (widget)
		{
			switch (widget.get_value())
			{
				case 'print':
					if (template.isDirty())
					{
						template.submit();
					}
					egw_open(id, 'infolog', 'edit', {print: 1});
					break;
					// fkar
				case 'newmail':
					this.doCompose(null, null);
					break;
				default:
					template.submit();
			}
		}
	},

	/**
	 * Open infolog entry for printing
	 *
	 * @param {aciton object} _action
	 * @param {object} _selected
	 */
	infolog_menu_print: function (_action, _selected)
	{
		var id = _selected[0].id.replace(/^infolog::/g, '');
		egw_open(id, 'infolog', 'edit', {print: 1});
	},

	/**
	 * Trigger print() onload window
	 */
	infolog_print_preview_onload: function ()
	{
		var that = this;
		jQuery('#infolog-edit-print').bind('load', function () {
			var isLoadingCompleted = true;
			jQuery('#infolog-edit-print').bind("DOMSubtreeModified", function (event) {
				isLoadingCompleted = false;
				jQuery('#infolog-edit-print').unbind("DOMSubtreeModified");
			});
			setTimeout(function () {
				isLoadingCompleted = false;
			}, 1000);
			var interval = setInterval(function () {
				if (!isLoadingCompleted)
				{
					clearInterval(interval);
					that.infolog_print_preview();
				}
			}, 100);
		});
	},

	/**
	 * Trigger print() function to print the current window
	 */
	infolog_print_preview: function ()
	{
		this.egw.message('Printing...');
		this.egw.window.print();
	},

	/**
	 *
	 */
	add_link_sidemenu: function ()
	{
		egw.open('', 'infolog', 'add');
	},

	/**
	 * Wrapper so add -> New actions in the context menu can pass current
	 * filter values into new edit dialog
	 *
	 * @see add_with_extras
	 *
	 * @param {egwAction} action
	 * @param {egwActionObject[]} selected
	 */
	add_action_handler: function (action, selected)
	{
		var nm = action.getManager().data.nextmatch || false;
		if (nm)
		{
			this.add_with_extras(nm, action.id,
					nm.getArrayMgr('content').getEntry('action'),
					nm.getArrayMgr('content').getEntry('action_id')
					);
		}
	},

	/**
	 * Opens a new edit dialog with some extra url parameters pulled from
	 * standard locations.  Done with a function instead of hardcoding so
	 * the values can be updated if user changes them in UI.
	 *
	 * @param {et2_widget} widget Originating/calling widget
	 * @param _type string Type of infolog entry
	 * @param _action string Special action for new infolog entry
	 * @param _action_id string ID for special action
	 */
	add_with_extras: function (widget, _type, _action, _action_id)
	{
		// We use widget.getRoot() instead of this.et2 for the case when the
		// addressbook tab is viewing a contact + infolog list, there's 2 infolog
		// etemplates
		var nm = widget.getRoot().getWidgetById('nm');
		var nm_value = nm.getValue() || {};

		// It's important that all these keys are here, they override the link
		// registry.
		var action_id = nm_value.action_id ? nm_value.action_id : (_action_id != '0' ? _action_id : "") || "";
		if (typeof action_id == "object" && typeof action_id.length == "undefined")
		{
			// Need a real array here
			action_id = jQuery.map(action_id, function (val) {
				return val;
			});
		}

		// No action?  Try the linked filter, in case it's set
		if (!_action && !_action_id)
		{
			if (nm_value.col_filter && nm_value.col_filter.linked)
			{
				var split = nm_value.col_filter.linked.split(':') || '';
				_action = split[0] || '';
				action_id = split[1] || '';
			}
		}
		var extras = {
			type: _type || nm_value.col_filter.info_type || "task",
			cat_id: nm_value.cat_id || "",
			action: nm_value.action || _action || "",
			// egw_link can handle arrays, but server is expecting CSV
			action_id: typeof action_id.join != "undefined" ? action_id.join(',') : action_id
		};
		egw.open('', 'infolog', 'add', extras);
	},

	/**
	 * Get title in order to set it as document title
	 * @returns {string}
	 */
	getWindowTitle: function ()
	{
		var widget = this.et2.getWidgetById('info_subject');
		if (widget)
			return widget.options.value;
	},

	/**
	 * View parent entry with all children
	 *
	 * @param {aciton object} _action
	 * @param {object} _selected
	 */
	view_parent: function (_action, _selected)
	{
		var data = egw.dataGetUIDdata(_selected[0].id);
		if (data && data.data && data.data.info_id_parent)
		{
			egw.link_handler(egw.link('/index.php', {
				menuaction: "infolog.infolog_ui.index",
				action: "sp",
				action_id: data.data.info_id_parent,
				ajax: "true"
			}), "infolog");
		}
	},

	/**
	 * Go to parent entry
	 *
	 * @param {aciton object} _action
	 * @param {object} _selected
	 */
	has_parent: function (_action, _selected)
	{
		var data = egw.dataGetUIDdata(_selected[0].id);

		return data && data.data && data.data.info_id_parent > 0;
	},

	/**
	 * Submit template if widget has a value
	 *
	 * Used for project-selection to update pricelist items from server
	 *
	 * @param {DOMNode} _node
	 * @param {et2_widget} _widget
	 */
	submit_if_not_empty: function (_node, _widget)
	{
		if (_widget.get_value())
			this.et2._inst.submit();
	},

	/**
	 * Insert text at the cursor position (or end) of a text field
	 *
	 * @param {et2_inputWidget|string} widget Either a widget object or it's ID
	 * @param {string} text [text=timestamp username] Text to insert
	 */
	insert_text: function (widget, text)
	{
		if (text == null)
		{
			// Get properly formatted user name
			var user = parseInt(egw.user('account_id'));
			var accounts = egw.accounts('accounts');

			for (var j = 0; j < accounts.length; j++)
			{
				if (accounts[j].value === user)
				{
					text = accounts[j].label;
					break;
				}
			}
			text += ' ';

			var now = new Date();
			//text += date(egw.preference('dateformat') + ' ' + (egw.preference("timeformat") === "12" ? "h:ia" : "H:i")+'',now);
			text += date("d.m.Y" + ' ' + (egw.preference("timeformat") === "12" ? "h:ia" : "H:i") + '', now);
			text += ': ';
		}

		if (typeof(widget) === 'string') {
			widget = jQuery(['#infolog-edit', widget].join('_'));
			if (widget.length === 0) {
				return;
			}

			let c  = widget.val();
			widget.val(c + text);
			return;
		}

		if (!widget || !widget.input)
		{
			return;
		}

		var input = widget.input[0];
		var scrollPos = input.scrollTop;
		var browser = ((input.selectionStart || input.selectionStart == "0") ?
					   "standards" : (document.selection ? "ie" : false));

		var pos = 0;

		// Find cursor or selection
		if (browser == "ie")
		{
			input.focus();
			var range = document.selection.createRange();
			range.moveStart("character", -input.value.length);
			pos = range.text.length;
		} else if (browser == "standards") {
			pos = input.selectionStart;
		}

		let front = (input.value).substring(0, pos);
		let back = (input.value).substring(pos, input.value.length);
		input.value = front + text + back;

		// Clean up a little
		pos = pos + text.length;
		if (browser == "ie") {
			input.focus();
			var range = document.selection.createRange();
			range.moveStart("character", -input.value.length);
			range.moveStart("character", pos);
			range.moveEnd("character", 0);
			range.select();
		} else if (browser == "standards") {
			input.selectionStart = pos;
			input.selectionEnd = pos;
			input.focus();
		}

		input.scrollTop = scrollPos;
	},

	/**
	 * Toggle encryption
	 *
	 * @param {jQuery.Event} _event
	 * @param {et2_button} _widget
	 * @param {DOMNode} _node
	 */
	toggleEncrypt: function (_event, _widget, _node)
	{
		if (!this.egw.user('apps').stylite)
		{
			this.egw.message(this.egw.lang('InfoLog encryption requires EPL Subscription') + ': <a href="http://www.egroupware.org/EPL">www.egroupware.org/EPL</a>');
			return;
		}
		this._get_stylite(function () {
			app.stylite.toggleEncrypt.call(app.stylite, _event, _widget, _node);
		});
	},

	/**
	 * Make sure stylite javascript is loaded, and call the given callback when it is
	 *
	 * @param {function} callback
	 * @param {object} attrs
	 *
	 */
	_get_stylite: function (callback, attrs)
	{
		// use app object from etemplate2, which might be private and not just window.app
		var app = this.et2.getInstanceManager().app_obj;

		if (!app.stylite)
		{
			var self = this;
			egw_LAB.script('stylite/js/infolog-encryption.js?' + this.et2.getArrayMgr('content').data.encryption_ts).wait(function ()
			{
				app.stylite = new app.classes.stylite;
				app.stylite.et2 = self.et2;
				if (callback)
				{
					callback.apply(app.stylite, attrs);
				}
			});
		} else
		{
			app.stylite.et2 = this.et2;
			callback.apply(app.stylite, attrs);
		}
	},

	/**
	 * OnChange callback for responsible
	 *
	 * @param {jQuery.Event} _event
	 * @param {et2_widget} _widget
	 */
	onchangeResponsible: function (_event, _widget)
	{
		if (app.stylite && app.stylite.onchangeResponsible)
		{
			app.stylite.onchangeResponsible.call(app.stylite, _event, _widget);
		}
	},

	/**
	 * Action handler for context menu change responsible action
	 *
	 * We populate the dialog with the current value.
	 *
	 * @param {egwAction} _action
	 * @param {egwActionObject[]} _selected
	 */
	change_responsible: function (_action, _selected)
	{
		var et2 = _selected[0].manager.data.nextmatch.getInstanceManager();
		var responsible = et2.widgetContainer.getWidgetById('responsible');
		if (responsible)
		{
			responsible.set_value([]);
			et2.widgetContainer.getWidgetById('responsible_action[title]').set_value('');
			et2.widgetContainer.getWidgetById('responsible_action[title]').set_class('');
			et2.widgetContainer.getWidgetById('responsible_action[ok]').set_disabled(_selected.length !== 1);
			et2.widgetContainer.getWidgetById('responsible_action[add]').set_disabled(_selected.length === 1)
			et2.widgetContainer.getWidgetById('responsible_action[delete]').set_disabled(_selected.length === 1)
		}

		if (_selected.length === 1)
		{
			var data = egw.dataGetUIDdata(_selected[0].id);

			if (responsible && data && data.data)
			{
				et2.widgetContainer.getWidgetById('responsible_action[title]').set_value(data.data.info_subject);
				et2.widgetContainer.getWidgetById('responsible_action[title]').set_class(data.data.sub_class)
				responsible.set_value(data.data.info_responsible);
			}
		}

		nm_open_popup(_action, _selected);
	},

	/**
	 * Handle encrypted info_desc for print purpose
	 * and triggers print action after decryption
	 *
	 * @param {Keyring} _keyring Mailvelope keyring to use
	 */
	printEncrypt: function (_keyring)
	{
		//this.mailvelopeAvailable(this.toggleEncrypt);
		var info_desc = this.et2.getWidgetById('info_des');

		var self = this;
		mailvelope.createDisplayContainer('#infolog-edit-print_info_des', info_desc.value, _keyring).then(function (_container)
		{
			var $info_des_dom = jQuery(self.et2.getWidgetById('info_des').getDOMNode());
			//			$info_des_dom.children('iframe').height($info_des_dom.height());
			$info_des_dom.children('span').hide();
			//Trigger print action
			self.infolog_print_preview();
		},
				function (_err)
				{
					self.egw.message(_err, 'error');
				});
	},

//fkar start
// Filter by Client,Infolog,Order
	filterAction: function (action, elements) {
		var filter, id;

		// Get element
		id = elements[0].id.split('::')[1];

		var nm = this.et2.getWidgetById('nm');
		// Get filter value from db
		egw.json('infolog.infolog_ajax.ajax_getFilterById', [id, action.id], function (result) {
			// Get Filter
			switch (action.id) {
				case 'filter_by_category':
					nm.activeFilters['cat_id'] = result;
					break;
				case 'filter_by_client':
					nm.activeFilters['col_filter'][ 'linked' ] = result;
					break;
			}
			// Populate filters dynamically
			nm.applyFilters();
		}).sendRequest(true);

		return false;
	},
//open client in new tab

	getWindowTitle: function () {
		//Return null so JS uses PHP set title instead
		return '';
	},
	open_client_new_tab: function (_event, _selected) {
		var id = _selected[0].id.split('::')[1];


		egw.json('infolog.infolog_ajax.ajax_getClientIdById', [id], function (result) {

			var params = {
				menuaction: 'acclients.acclients_ui.edit',
				id: result,
				ajax: 'true',
				hidemenus: 'true',
			}
			var popup = window.open(egw.link('/index.php', params), '_blank');
			if (popup.opener)
				popup.opener = null;
			return false;

		}).sendRequest(true);


	},
	openTab: function (_event, _selected) {

		var id = _selected[0].id.split('::')[1];

		var params = {
			menuaction: 'infolog.infolog_ui.edit',
			info_id: id,
			ajax: 'true',
			hidemenus: 'true',
		}
		var popup = window.open(egw.link('/index.php', params), '_blank');
		if (popup.opener)
			popup.opener = null;

		if (popup)
		{
			var that = this;
			var poll = this.egw.window.setInterval(
					function () {
						if (popup.closed) {
							that.egw.window.clearInterval(poll);
							that.egw.refresh('Entry Updated', 'infolog', _selected[0].id, 'update');
						}
					}, 1000
					);
		}
		return false;
	},
//open index in new tab
	openTabIndex: function () {

		var params = {
			menuaction: 'infolog.infolog_ui.index',
			ajax: 'true',
			istab: 'true',
			hidemenus: 'true'

		}
		var popup = window.open(egw.link('/index.php', params), '_blank');
		popup.opener = null;

		return false;
	},
	stampCopy: function (_event, _widget) {
		// Get stamp from hidden
		var stamp = this.et2.getWidgetById('info_stamp').node.textContent;
		//Create tmp element
		var tmp = jQuery('<span>');
		tmp.html(stamp.trim());
		jQuery('body').append(tmp);
		//Select element
		var range = document.createRange();
		range.selectNodeContents(tmp.get(0));
		var sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
		//Copy
		document.execCommand('copy');
		this.egw.message('Copied Stamp to Clipboard');
		//Delete element
		tmp.remove();
	},
// Dyncamically load link list when Link tab is clicked
	loadLinks: function () {
		var id = this.et2.getArrayMgr('content').data.info_id;
		var link = this.et2.getWidgetById('link_to');
		var list = null;
		if (link._type == 'link-to') {
			// Get list (has same id as link -_- )
			link.getRoot().iterateOver(function (widget) {
				if (widget.id == link.id)
					list = widget;
			}, this, et2_link_list);
		} else {
			list = link;
		}


		// Load if needed
		if (!list.value) {
			var obj = {
				to_app: 'infolog',
				to_id: id
			};
			list.set_value(obj);
			list._get_links();
			link.options.value = obj;
		}
	},
// This becomes default action with which to open
// This happens because we need to mark mail as read first before opening it
	openEdit: function (_event, _selected) {
		var id;

		// Called from index
		id = _selected[0].id.split('::')[1];
		this.setReadUnread('edit');

		var params = {
			menuaction: 'infolog.infolog_ui.edit',
			info_id: id,
			ajax: 'true'
		}
		egw.openPopup(egw.link('/index.php', params), 800, 400, 'infolog_edit_' + id);
		return false;
	},
// Flag mail as read
	setRead: function () {
		this.setReadUnread('read');
	},
// Flag mail as unread
	setUnread: function () {
		this.setReadUnread('unread');
	},
	setReadUnread: function (flag) {
		var nm = app.infolog.et2.getWidgetById('nm');
		var selected = nm.getSelection();

		egw.json('infolog.infolog_ajax.ajax_setReadUnread', [selected.ids, flag], function (response) {
			var elems = {'msg': selected.ids};
			if (flag == 'unread') {
				app.infolog.removeClass(elems, 'seen_info');
				app.infolog.setClass(elems, 'unseen_info');
			} else {
				app.infolog.removeClass(elems, 'unseen_info');
				app.infolog.setClass(elems, 'seen_info');
			}

			app.infolog.egw.refresh(response.msg, 'infolog', selected.ids, 'update');

		}).sendRequest(true);

	},
	setReadAll: function () {

		// Show confirmation dialog
		et2_dialog.show_dialog(function (res) {
			if (res == et2_dialog.YES_BUTTON) {

				// Ajax call
				egw.json('infolog.infolog_ajax.ajax_setReadUnread', [[], 'read_all'], function (response) {
					app.infolog.egw.refresh("All infologs have been marked as read", 'infolog');
				}).sendRequest(true);
			}
		},
				this.egw.lang("This action will mark all infologs in egroupware as read, not just the current filter. Are you sure you want to continue?"),
				this.egw.lang("Mark All Infologs as Read"),
				{}, et2_dialog.BUTTONS_YES_NO_CANCEL, et2_dialog.WARNING_MESSAGE);

		return false;
	},
// Generic remove class from element
	removeClass: function (elems, _class) {
		for (var i = 0; i < elems.length; i++)
		{
			var dataElem = jQuery(elems[i].iface.getDOMNode());
			dataElem.removeClass(_class);
		}
	},
// Generic add class to element
	setClass: function (elems, _class) {
		for (var i = 0; i < elems.length; i++)
		{
			var dataElem = jQuery(elems[i].iface.getDOMNode());
			dataElem.addClass(_class);
		}
	},
	initDisabled: function () {
		jQuery('.disabled').attr('readonly', 'readonly');
	},
	initTree: function (reset_selected = false) {
		//Ignore if disabled
		if (egw.preference('unread_filters_off', 'infolog'))
			return;

		var nm = this.et2.getWidgetById('nm');
		if (!nm)
			return;

		//Get nm active filters,
		var query = nm.activeFilters;
		var tree = app.infolog.et2.getWidgetById('infolog_tree');

		// Ignore if in iframe
		if (query.col_filter.mode)
			return;

		// Get Open Items State to restore later
		var all = tree.getTreeNodeOpenItems(0);
		var to_open = [];
		all.forEach(function (node) {
			node = node + "";
			if (node.match('::') != null) {
				var array = node.split('::');
				array.pop();
				array = array.join('::');
				if (to_open.indexOf(array) == -1)
					to_open.push(array);
			}
		});

		// Get selected item to restore later
		var selected = tree.getValue();

		//Delay the filters function to allow nextmatch to load
		//For some reason ajax runs sequentially
		window.setTimeout(function () {
			//Pass to function
			egw.json('infolog.infolog_ajax.ajax_treeLoad', [query], function (response) {
				// Refresh tree node with new data
				tree.refreshItem(0, response);
				// Restore original state
				to_open.forEach(function (node) {
					tree.openItem(node, true);
				});
				// Restore selected node
				if (!reset_selected)
					tree.reSelectItem(selected);
			}).sendRequest(true);
		}, 300);

	},
	checked_done: function (element, widget) {

		if (this.et2.getWidgetById('info_done').get_value()=="done") {
			this.et2.getWidgetById('info_percent').set_value('100');
			this.et2.getWidgetById('info_status').set_value('done');
			this.set_days_open('', '');
		} else{
			this.et2.getWidgetById('info_percent').set_value('90');
			this.et2.getWidgetById('info_status').set_value('ongoing');
			this.set_days_open('', '');
		}

	},
	change_rs:  function(){
	if(jQuery('#infolog-edit_info_type').length>0){
        // if(jQuery('#infolog-edit_info_startdate input').val().length>0 && jQuery('#infolog-edit_info_enddate input').val().length>0){
        //     if(jQuery('#infolog-edit_info_startdate input').val()>jQuery('#infolog-edit_info_enddate input').val()){
        //         msg = msg + 'Η ημερομηνία λήξης του τρέχοντος βήματος ('+ jQuery('#infolog-edit_info_enddate input').val() +') πρέπει να είναι μεταγενέστερη ή ίση της ημερομηνίας έναρξης του βήματος (' + jQuery('#infolog-edit_info_startdate input').val() + ').';
        //     }
        // }

        // if(jQuery('#infolog-edit_info_first_startdate input').val().length>0 && jQuery('#infolog-edit_info_last_enddate input').val().length>0){
        //     if(jQuery('#infolog-edit_info_first_startdate input').val()>jQuery('#infolog-edit_info_last_enddate input').val()){
        //         msg = msg + 'Η ημερομηνία λήξης της εργασίας (' + jQuery('#infolog-edit_info_last_enddate input').val() + ') πρέπει να είναι μεταγενέστερη ή ίση της ημερομηνίας έναρξης της εργασίας (' + jQuery('#infolog-edit_info_first_startdate input').val() + ').';
        //     }
        // }


	// if(jQuery('#infolog-edit_info_first_startdate input').val().length>0 && jQuery('#infolog-edit_info_startdate input').val().length>0){
        //     if(jQuery('#infolog-edit_info_first_startdate input').val()>jQuery('#infolog-edit_info_startdate input').val()){
        //         msg = msg + 'Η ημερομηνία έναρξης του βήματος της εργασίας (' + jQuery('#infolog-edit_info_startdate input').val() + ') πρέπει να είναι μεταγενέστερη ή ίση της ημερομηνίας έναρξης της εργασίας. (' + jQuery('#infolog-edit_info_first_startdate input').val() + ').';
        //     }
        // }

	// if(jQuery('#infolog-edit_info_enddate input').val().length>0 && jQuery('#infolog-edit_info_last_enddate input').val().length>0){
        //     if(jQuery('#infolog-edit_info_enddate input').val()>jQuery('#infolog-edit_info_last_enddate input').val()){
        //         msg = msg + 'Η ημερομηνία λήξης του βήματος της εργασίας ' + jQuery('#infolog-edit_info_enddate input').val() + ' πρέπει να είναι προγενέστερη ή ίση της ημερομηνίας λήξης της εργασίας. ' +jQuery('#infolog-edit_info_last_enddate input').val()+ ').';
        //     }
        // }

        //merge info_responsible_step into info_responsible
        if( jQuery("#infolog-edit_info_responsible_step").val()!='42' &&
            jQuery("#infolog-edit_info_responsible_step").val()!='32' &&
            jQuery("#infolog-edit_info_responsible_step").val()!='33'){

            var dataarray1=jQuery("#infolog-edit_info_responsible_step").val();
            var dataarray2=jQuery("#infolog-edit_info_responsible").val();

            var array1 = new Array();


            // Merges both arrays and gets unique items
            var array3=array1.concat(dataarray1,dataarray2);

            var uniqueNames = [];
            jQuery.each(array3, function(i, el){
                if(jQuery.inArray(el, uniqueNames) === -1) uniqueNames.push(el);
            });
            var test=uniqueNames.toString();
            //alert(test);
            jQuery("#infolog-edit_info_responsible").val(uniqueNames);
            jQuery("#infolog-edit_info_responsible").trigger("liszt:updated");
        }

        //add infotypes to ignore responsible step check
		//(info_type!='note' && info_type!='task_grouping')
        if(info_type!='task_grouping'){
            if( jQuery("#infolog-edit_info_responsible_step").val()=='42' ||
                jQuery("#infolog-edit_info_responsible_step").val()=='32' ||
                jQuery("#infolog-edit_info_responsible_step").val()=='33') {
                msg = msg + 'Ο Υπέυθυνος τρέχοντος βήματος δεν πρέπει να είναι o operator ή χρήστης zzzxxx. ';
            }
        }

        //check responsibles for info_type = phone
        if(info_type=='phone'){
            if(jQuery("#infolog-edit_info_responsible").val()=='' || jQuery("#infolog-edit_info_responsible").val()==null){
                msg = msg + 'Πρέπει να επιλέξετε τουλάχιστον έναν συμμετάσχοντα για εργασία τύπου \'Τηλέφωνο\'. ';
            }
        }
    }
	},
	set_days_open: function (element, widget) {

		//alert(this.et2.getWidgetById('info_enddate').get_value());
		//return 0;

		if (this.et2.getWidgetById('info_percent').get_value()=='100' ||
			this.et2.getWidgetById('info_status').get_value()=='done' ||
			this.et2.getWidgetById('info_status').get_value()=='cancelled' ||
			this.et2.getWidgetById('info_enddate').get_value()==null){
			this.et2.getWidgetById('info_days_open').set_value('');
			this.et2.getWidgetById('working_time_remain').set_value('');
			return 0;
		}

		//var dateselected = Math.round(new Date(this.et2.getWidgetById('info_enddate').get_value()).getTime()/1000);
		//var datenow =  Math.round(Date.now()/1000);
		var dateselected_tmp = new Date(this.et2.getWidgetById('info_enddate').get_value())

		var date_selected_miliseconds = dateselected_tmp.valueOf() + Math.round(dateselected_tmp.getTimezoneOffset()*60*1000);

		var dateselected = new Date(date_selected_miliseconds);

		console.log("date selected:" + dateselected.toLocaleString());
		//console.log("date selected offset"+dateselected.getTimezoneOffset());

		var datetemp = Math.round(Date.now());
		//datetemp = Math.round(datetemp/1000);
		datetemp = Math.round(datetemp/1000);
		this.et2.getWidgetById('date_time_now').set_value(datetemp);
		datetemp = datetemp*1000;

		//var datenow_tmp = new Date(this.et2.getWidgetById('date_time_now').get_value())

		var datenow = new Date(datetemp)

		//var datenow_miliseconds = datenow_tmp.valueOf() + Math.round(datenow_tmp.getTimezoneOffset()*60*1000);

		//var datenow = new Date(datenow_miliseconds);

		console.log("date now:" + datenow.toLocaleString());
		console.log("date now offset:" + datenow.getTimezoneOffset());

		datenow.setHours(datenow.getHours());

		//datenow = Math.round(datenow / 1000);
		//new Date().toLocaleString("en-US", {timeZone: "America/New_York"})

		//console.log("date selected:" + dateselected.toLocaleString());
		//console.log("date now:" + datenow.toLocaleString());
		//console.log("date selected GR:" + dateselected.toLocaleString("el-EL", {timeZone: "Europe/Athens"}));
		//console.log("date now GR:" + datenow.toLocaleString("el-EL", {timeZone: "Europe/Athens"}));


		//var time_remain = Math.floor((datenow-dateselected)/60/60)+3;

		if (datenow < dateselected ) {

		var start = new Date(datenow.valueOf()) ;
		var end = new Date(dateselected.valueOf());
		var worktime_remain = this.workingHoursBetweenDates(start, end, 9, 17, true);

		} else {

		var start = new Date(dateselected.valueOf()) ;
		var end = new Date(datenow.valueOf());
		var worktime_remain = 0;

		}





		var days_remain  = Math.floor((Math.round(dateselected.valueOf()/1000/60)-Math.round(datenow.valueOf()/1000/60))/60/24);
		var hours_remain = Math.floor((Math.round(dateselected.valueOf()/1000/60)-Math.round(datenow.valueOf()/1000/60))/60)-days_remain*24;
		var minutes_remain = (Math.round(dateselected.valueOf()/1000/60)-Math.round(datenow.valueOf()/1000/60)) - days_remain*24*60 - hours_remain*60;
		var time_overdue = Math.round(datenow.valueOf()/1000/60/60)-Math.round(dateselected.valueOf()/1000/60/60);

		console.log("now:"+datenow.valueOf()+" gettime "+datenow.getTime() + " round: " + Math.round(datenow.valueOf()/1000)+"date now    GR:" + datenow.toLocaleString("el-EL", {timeZone: "Europe/Athens"}));
		console.log("selected:"+dateselected.valueOf()+" gettime "+dateselected.getTime() +" round: " +  Math.round(dateselected.valueOf()/1000)+"date selected GR:" + dateselected.toLocaleString("el-EL", {timeZone: "Europe/Athens"}));

		overdue = Math.round(datenow.valueOf()/1000)-Math.round(dateselected.valueOf()/1000);

		console.log("now-sel "+overdue);

		if (datenow > dateselected ) {
			var days_class = " info_days_overdue ";
			var date_class = " DateStepEnd_overdue ";
			console.log("now is smaler");
			var result = "Έχει καθυστερήσει";
			var working_time_remain = time_overdue + " ώρες";
            this.et2.getWidgetById('today_text').set_value("Σήμερα (Ημ/Ώρα)");

		} else {
			console.log( "now is bigger");
			var days_class = " info_days_intime ";
			var date_class = " ";
			var result = "απομένουν: " + days_remain + "ημ. "+ hours_remain + "ώρ. "+minutes_remain+"λ.";
			var working_time_remain = "(περίπου "+worktime_remain+" ώρ.εργασίας)";
			this.et2.getWidgetById('today_text').set_value("Σήμερα (Ημ/Ώρα)");
		}
		//alert(dateselected+"    Date Now:"+datenow+'Days'+Math.round((datenow-dateselected)/60/60/24));
		this.et2.getWidgetById('info_days_open').set_value(result);
		this.et2.getWidgetById('info_days_open').set_class(days_class);
		this.et2.getWidgetById('working_time_remain').set_value(working_time_remain);
		this.et2.getWidgetById('working_time_remain').set_class(days_class);
		this.et2.getWidgetById('info_enddate').set_class(date_class);
	},
// Simple function that accepts two parameters and calculates
// the number of hours worked within that range
//http://rion.io/2014/06/20/calculating-business-hours-in-javascript/
	workingHoursBetweenDates: function (startDate, endDate, dayStart, dayEnd, includeWeekends) {
		// Store minutes worked
		var minutesWorked = 0;

		// Validate input
		if (endDate < startDate) { return 0; }

		// Loop from your Start to End dates (by hour)
		var current = startDate;

		// Define work range
		var workHoursStart = dayStart;
		var workHoursEnd = dayEnd;

		// Loop while currentDate is less than end Date (by minutes)
		while (current <= endDate) {
			// Store the current time (with minutes adjusted)
			var currentTime = current.getHours() + (current.getMinutes() / 60);

			// Is the current time within a work day (and if it
			// occurs on a weekend or not)
			if (currentTime >= workHoursStart && currentTime < workHoursEnd && (includeWeekends ? current.getDay() !== 0 && current.getDay() !== 6 : true)) {
				minutesWorked++;
			}

			// Increment current time
			current.setTime(current.getTime() + 1000 * 60);
		}

		// Return the number of hours
		return (minutesWorked / 60).toFixed(2);
		//return minutesWorked;
	},
// On filter click:
	setUnreadFilter: function (node, tree, prev) {
		if (node == prev) {
			// Reset filters
			var nm = this.et2.getWidgetById('nm');
			nm.activeFilters['col_filter']['string_ids'] = '';
			nm.applyFilters();
			app.infolog.initTree(true);
			return;
		}
		var array = node.split('::');
		var filter = array[0];
		var client_id = array[1];
		var type = null;
		if (array[2])
			type = array[2];
		var nm = this.et2.getWidgetById('nm');

		// Clone filters without changing them
		var query = jQuery.extend(true, {}, nm.activeFilters);

		// If favorites, pass whole query
		if (filter == 'unread_favorites') {
			nm.activeFilters = tree.getUserData(node, 'query');
			query = tree.getUserData(node, 'query');
		}
		if (query) {
			egw.json('infolog.infolog_ajax.ajax_getFilterIds', [query, filter, client_id, type], function (response) {
				//Get ids and filter by those
				nm.activeFilters['col_filter']['string_ids'] = (response ? response : '-1');
				nm.applyFilters();
				app.infolog.initTree();
			}).sendRequest(true);
		}

	},

//Compose mail
	doCompose: function (event, widget) {

		var id = this.et2.getWidgetById('info_number').node.textContent;
		var params = {
			menuaction: 'mail.mail_compose.compose',
			infolog_id: id,
		}
		var width = 870;
		var height = 600;
		var windowName = 'infolog_compose';
		egw.openPopup(egw.link('/index.php', params), width, height, windowName);
	},
	mailPopup: function (event, widget) {

		//Cannot implement
		// trying to use nm_open_popup, but this requires
		// An action object, and the nextmatch it came from

		// Options:
		// 1) trying to replicate nm_open_popup as below
		// 2) Try to use et2.dialog? or another popup in order to pass info to mail template

		// var popup = jQuery("#infolog-edit_mail_template_popup").first();
		// var dialog = jQuery('.action_popup-content',popup);
		// var dialog_parent = dialog.parent();
		// dialog.dialog({
		// title: jQuery('.promptheader',popup).text(),
		// modal: true,
		// // buttons: d_buttons,
		// // minWidth: dialog_width,
		// close: function(event, ui) {
		// // Need to destroy the dialog, etemplate widget needs divs back where they were
		// dialog.dialog("destroy");

		// // Put it back where it came from, or et2 will error when clear() is called
		// dialog.appendTo(dialog_parent);
		// // buttons.show();
		// }
		// });
	},
	doComposeTemplate: function (event, widget) {

		var selected = this.et2.getWidgetById('nm').getSelection();
		var id = selected.ids[0];
		id = id.split('::')[1];
		var popup = this.et2.getWidgetById('mail_template_popup');
		var language = popup.getWidgetById('language').getValue();
		var template = popup.getWidgetById('template').getValue();
		var entries = popup.getWidgetById('entries').getValue();
		var params = {
			menuaction: 'mail.mail_compose.compose',
			infolog_id: id,
			template: template,
			entries: entries,
			language: language
		}
		var width = 870;
		var height = 600;
		var windowName = 'infolog_compose';
		egw.openPopup(egw.link('/index.php', params), width, height, windowName);
	},

// Create vfs folder for infolog
	createFolder: function (event, widget) {
		var id = this.et2.getWidgetById('info_number').node.textContent;
		egw.json('infolog.infolog_ajax.ajax_createFolder', [id], function (response) {
			if (response.success) {
				app.infolog.egw.message("Infolog folder Created");
				widget.destroy();
			} else
				app.infolog.egw.message("Error: Could not create folder");
		}).sendRequest(true);
	},

//Load acactivity tree
	loadAcTree: function () {
		if (window.tree_initialized)
			return;
		window.tree_initialized = true;

		var id = app.infolog.et2.getWidgetById('info_number').options.value;
		var contact = app.infolog.et2.getWidgetById('info_contact').getValue();
		var cat = app.infolog.et2.getWidgetById('info_cat').getValue();
		var etemplate_exec_id = jQuery('#infolog-edit').data('etemplate').data.etemplate_exec_id;

		// Get all data needed from ajax
		egw.json('infolog.infolog_ajax.ajax_loadAcTree', [id, contact, cat, etemplate_exec_id], function (response) {
			// Fill into DOM
			for (var widget_id in response.content)
				app.infolog.et2.getWidgetById(widget_id).set_value(response.content[ widget_id ]);

			// var selectboxes = ['actions_details','activity_action_id','order_id','action_id','orders','actions'];
			var selectboxes = ['actions_details', 'orders', 'actions'];
			selectboxes.forEach(function (item) {
				app.infolog.et2.getWidgetById(item).set_select_options(response.sel_options[ item ]);
			});

			//Init custom functions
			activityInit();
		}).sendRequest(true);
	},
// Open actpm edit window
	newActpm: function () {
		var id = app.infolog.et2.getWidgetById('info_number').options.value;
		var client = app.infolog.et2.getWidgetById('info_contact').getValue();
		var params = {
			menuaction: 'actpm.actpm_ui.editEntry',
			info_id: id,
			client_id: client,
			ajax: 'true'
		}
		egw.openPopup(egw.link('/index.php', params), 800, 400, 'actpm_edit_info_' + id);
	},
	showWarning: function (event, widget, element) {
		var id = app.infolog.et2.getWidgetById('info_number').options.value;
		var des = app.infolog.et2.getWidgetById('info_des').getValue();
		var type = app.infolog.et2.getWidgetById('info_type').getValue();

		egw.json('infolog.infolog_ajax.ajax_showWarning', [id, des, type], function (show) {

			if (show) {
				if (confirm('Μήπως Θέλετε να συμπληρώσετε χρόνο; (έχετε επεξεργαστεί την περιγραφή του infolog)')) {
					// Go to acactivity
					jQuery(".et2_tabflag.tab_acactivity2").trigger('click');

					// Save infolog anyway
					app.infolog.changed = false;
					var apply = app.infolog.et2.getWidgetById('button[apply]');
					apply.getInstanceManager().submit(apply, false, apply.options.novalidate);
				} else {
					// Perform intended action
					app.infolog.changed = false;
					widget.getInstanceManager().submit(widget, false, widget.options.novalidate);
				}
			} else {
				// Perform intended action
				app.infolog.changed = false;
				widget.getInstanceManager().submit(widget, false, widget.options.novalidate);
			}

		}).sendRequest(true);
	},
	showWarningNotSaved: function (event, widget, element) {
		var value = app.infolog.et2.getWidgetById('info_number').options.value;

		if (!value || app.infolog.changed) {
			// Show confirmation dialog
			et2_dialog.show_dialog(function (res) {
				if (res == et2_dialog.OK_BUTTON) {
					app.infolog.changed = false;
					window.close();
				}
			},
					this.egw.lang("You are about to exit infolog without saving the entry. Are you sure you want to continue?"),
					this.egw.lang("Exit Infolog"),
					{}, et2_dialog.BUTTONS_OK_CANCEL, et2_dialog.WARNING_MESSAGE);

			return false;
		}

		window.close();
	},
	reload: function ()
	{
		this.et2.getWidgetById('nm').applyFilters();
	},
	toggleFilters: function () {
		jQuery('#infolog-index_infolog-index-filters .filterContainer').toggleClass('hidden');
		app.infolog.hideAllFilters();
		return false;
	},
	hideAllFilters: function () {
		if (jQuery('#infolog-index_infolog-index-filters .filterContainer').hasClass('hidden')) {
			jQuery('#infolog-index_infolog-index-filters').addClass('hidden');
		} else {
			jQuery('#infolog-index_infolog-index-filters').removeClass('hidden');
		}
	},
	changeTab: function (obj, reload) {
		var tab = jQuery(obj).attr('class').match(/tab_(\w+)/);

		// Load tab if needed
		if (tab) {
			switch (tab[1]) {
				case 'actpm':
				case 'acactivity2':
				case 'acemailstor':
				case 'filemanager':
				case 'children':
				case 'links2':
					this.loadIframe(tab[1], reload);
					break;
				case 'links':
					app.infolog.loadLinks();
					break;
			}
		}

		// Change title
		var title = document.title.split('-');
		title.pop();
		title.push(jQuery(obj).html());
		document.title = title.join('-');

		return false;
	},
	loadIframe: function (name, always) {
		jQuery('#' + name + '_iframe').focus();
		if (always || !this.loaded[ name ]) {
			var url = app.infolog.et2.getWidgetById(name + '_iframe_load').getValue();
			jQuery('#' + name + '_iframe').attr('src', url);
			this.loaded[ name ] = 1;
		}
	},
	toggleNotifications: function (_action, _selected)
	{
		this.no_notifications = _action.checked;
	},
	dynamicAction: function (_action, _selected)
	{
		var nm = app.infolog.et2.getWidgetById('nm');
		var query = nm.activeFilters;
		var selected = nm.getSelection();

		egw.json('infolog.infolog_ajax.ajax_dynamicAction', [selected.ids, _action.id, selected.all, query, this.no_notifications], function (response) {
			app.infolog.egw.refresh(response.msg, 'infolog', response.ids, 'update');
		})
				.sendRequest(true);
	},
	deleteEntries: function (action)
	{
		var _action = {id: action};
		this.dynamicAction(_action, []);
	},
	submitChangeMultiple: function () {

		var popup = {
			change_info_client_id: this.et2.getWidgetById('change_info_client_id').getValue(),
			delete_info_client_id: this.et2.getWidgetById('delete_info_client_id').getValue(),
		};
		var selected = this.et2.getWidgetById('nm').getSelection();
		var button = this.et2.getWidgetById('update');
		egw.json('infolog.infolog_ajax.ajax_changeMultiple', [popup, selected.ids],
				function (response) {
					//Get ids and filter by those
					app.infolog.egw.refresh(response.msg, 'infolog', selected.ids, 'update');
					nm_hide_popup(button, 'admin_popup');
				}
		).sendRequest(true);
		return false;
	},
//fkar end

});
