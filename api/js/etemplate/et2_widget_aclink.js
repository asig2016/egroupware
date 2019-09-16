/*egw:uses
 et2_widget_link;
 et2_widget_selectbox;
 /vendor/bower-asset/jquery/dist/jquery.js;
 /vendor/bower-asset/jquery/dist/jquery-ui.js;
 */

/**
 * Class
 *
 * @augments et2_link_entry
 */
var et2_aclink = (function () {
	"use strict";
	return et2_link_entry.extend({
		attributes: {
			"icon_width": {
				"name": "App Icon  Width",
				"type": "string",
				"default": "16",
				"description": "Width for Icon"
			},
			"icon_height": {
				"name": "App Icon Height",
				"type": "string",
				"default": "16",
				"description": "Height for Icon"
			},
			"listbox_empty_label": {
				"name": "Empty label",
				"type": "string",
				"default": "",
				"description": "Textual label for first row, eg: 'All' or 'None'.  ID will be ''",
				translate: true
			},
			"onEntryChange": {
				"name": "onEntryChange",
				"type": "string",
				"description": "Function for change event"
			},
			"link_hook": {
				"name": "Type",
				"type": "string",
				"default": "view",
				"description": "Hook used for displaying link (view/edit/add)"
			},
			"target_app": {
				"name": "Target Application",
				"type": "string",
				"default": "",
				"description": "Optional parameter to open links in specified app."
			},
			"listbox_autohide": {
				"name": "Hide listbox when it has no options",
				"type": "boolean",
				"default": true,
				"description": "Hide listbox when it has no options"
			},

		},
		/*
		 change: function (_node) {
		 alert('change called value');

		 if (this.get_value()) {

		 this.aclink.set_value({
		 id: this.get_value().toString(),
		 app: this.options.only_app.toString()
		 });

		 //jQuery(this.acbutton_show.getDOMNode()).show();

		 } else if(this.aclink) {
		 this.aclink.set_value({
		 id: null,
		 app: this.options.only_app.toString()
		 });
		 //jQuery(this.acbutton_show.getDOMNode()).hide();
		 //jQuery(this.acbutton_edit.getDOMNode()).show();
		 }

		 //now run the on change fuction definded in the widget
		 if (this.options && this.options.onEntryChange) {
		 this.executeFunctionByName(this.options.onEntryChange, window);
		 }

		 return this.__proto__.change(_node);

		 },
		 */
		createInputWidget: function () {
			this._super.apply(this, arguments);
			//console.log('test');

			//this.achbox = et2_createWidget('hbox', {}, this );
			// Create clickable application icon
			this.acbox1 = et2_createWidget('hbox', {width: "100%", class: "widget_aclink_flex"}, this);
			this.acbutton = et2_createWidget('appicon', {src: this.options.only_app, class: "widget_aclink", align: "center", height: this.options.icon_height, width: this.options.icon_width, label: "Click here to open link in new tab.", onclick: this.openEditInTab.bind(this)}, this.acbox1);
			this.acbutton_select = et2_createWidget('button', {image: "buyable", class: "widget_aclink", align: "center", height: this.options.icon_height, width: this.options.icon_width, label: "Click here to edit field.", onclick: this.doShowSelect.bind(this)}, this.acbox1);
			this.acbutton_search = et2_createWidget('button', {image: "search", class: "widget_aclink", align: "center", height: this.options.icon_height, width: this.options.icon_width, label: "Click here to show link.", onclick: this.doShowSearch.bind(this)}, this.acbox1);


			this.aclink = et2_createWidget('link-entry_ro', {id: this.options.id, width: "100%", only_app: this.options.only_app, class: "widget_aclink_link", link_hook: this.options.link_hook, target_app: this.options.target_app}, this.acbox1);
			this.acentry = et2_createWidget('link-entry', {id: this.options.id, empty_label: this.options.listbox_empty_label, only_app: this.options.only_app, class: this.options.class + " " + this.options.id + "aclink", link_hook: this.options.link_hook, target_app: this.options.target_app, onchange: this.acentry_change.bind(this)}, this.acbox1);
			this.acbox2 = et2_createWidget('hbox', {width: "100%"}, this.acbox1);
			this.aclistbox = et2_createWidget('listbox', {id: 'listbox_' + this.options.id, allow_single_deselect: true, empty_label: this.options.listbox_empty_label, multiple: false, search: true, width: "100%", onchange: this.aclistbox_change.bind(this)}, this.acbox2);
			this.acbutton_link = et2_createWidget('button', {image: "tick", class: "widget_aclink", align: "center", height: this.options.icon_height, width: this.options.icon_width, label: "Click here to show link.", onclick: this.doShowLink.bind(this)}, this.acbox1);

		},
		destroy: function () {
			// Unbind event when destroying object
			// Otherwise, when the page is refreshed a new event is generated with the same uid
			// so the old one is called instead with a null "this"
			this._super.apply(this, arguments);
		},
		doLoadingFinished: function () {

			//alert( this.options.id.toString()+'_loading')

			//By default hide widget et2_link_entry
			this.search.hide();
			this.clear.hide();
			this.clear.css('visibility', 'hidden');

			if (!this.options.readonly) {
				if (this.get_value()) {
					//When field has value, show link and hide show-button
					if (this.aclistbox) {
						this.aclistbox.set_value(this.get_value().toString());
					}
					this.doShowLink();
				} else if (this.should_hide_listbox() != true) {
					//When field has no value but listbox has options, then show listbox by default
					this.doShowSelect();
				} else {
					this.doShowSearch();
				}
			} else {
				this.doReadOnly();
			}

			return this._super.apply(this, arguments);
		},
		aclistbox_change: function () {
			//alert('listbox change');
			if (this.aclistbox.get_value() != -1) {

				this.aclink.set_value({
					id: this.aclistbox.get_value().toString(),
					app: this.options.only_app.toString()
				});

				this.set_value({
					id: this.aclistbox.get_value().toString(),
					app: this.options.only_app.toString()
				});

				this.acentry.set_value({
					id: this.aclistbox.get_value().toString(),
					app: this.options.only_app.toString()
				});


			} else {
				//alert('listbox change: no get value');
				if (this.aclink) {
					this.aclink.set_value({
						id: null,
						app: this.options.only_app.toString()
					});
				}
				if (this.get_value()) {
					this.clear.click();
				}

				if (this.acentry.get_value()) {
					this.acentry.clear.click();
				}

			}
		},
		clear_value: function () {

				if (this.aclink) {
					this.aclink.set_value({
						id: null,
						app: this.options.only_app.toString()
					});
				}

				if (this.aclistbox) {
					this.aclistbox.set_value(null);
				}

				if (this.get_value()) {
					this.clear.click();
				}

				if (this.acentry.get_value()) {
					this.acentry.clear.click();
				}

		},
		set_value_ac: function (value){

				this.aclink.set_value({
					id: value.toString(),
					app: this.options.only_app.toString()
				});

				this.set_value({
					id: value.toString(),
					app: this.options.only_app.toString()
				});

				this.acentry.set_value({
					id: value.toString(),
					app: this.options.only_app.toString()
				});

				if (this.aclistbox) {
					this.aclistbox.set_value(value.toString());
				}

		},
		acentry_change: function () {
			//alert('entry change');
			if (this.acentry.get_value()) {
				//alert('get value');
				this.aclink.set_value({
					id: this.acentry.get_value().toString(),
					app: this.options.only_app.toString()
				});

				this.set_value({
					id: this.acentry.get_value().toString(),
					app: this.options.only_app.toString()
				});

				if (this.aclistbox) {
					this.aclistbox.set_value(this.acentry.get_value().toString());
				}//Show link button
				//jQuery(this.acbutton_link.getDOMNode()).show();

			} else {
				//alert('no get value');
				if (this.aclink) {
					this.aclink.set_value({
						id: null,
						app: this.options.only_app.toString()
					});
				}
				if (this.aclistbox) {
					this.aclistbox.set_value(null);
				}

				if (this.get_value()) {
					this.clear.click();
				}
			}

		},
		openEditInTab: function () {

			if (this.get_value()) {

				var params = {
					ajax: 'true',
				}

				params.menuaction = this.options.only_app.toString() + '.' + this.options.only_app.toString() + '_ui.edit';
				params.id = this.get_value().toString()
				/*Hack to use with infolog */
				params.info_id = this.get_value().toString();
				params.hidemenus = 'true';
				window.open(egw.link('/index.php', params), '_blank');

			} else {
				alert(egw.lang("No entry selected, can't open tab"));
			}

		},
		doReadOnly: function () {
			this.doShowLink();
			//Show search button
			jQuery(this.acbutton_search.getDOMNode()).hide();

			//Hide select button
			jQuery(this.acbutton_select.getDOMNode()).hide();
		},
		doShowSelect: function () {
			//alert('show select');

			if (this.should_hide_listbox() === true) {
				//alert(this.options.id.toString() + '_go to search');
				this.doShowSearch();
			}

			//Show listbox
			jQuery(this.acbox2.getDOMNode()).show();

			//Show search button
			jQuery(this.acbutton_search.getDOMNode()).show();

			//Hide select button
			jQuery(this.acbutton_select.getDOMNode()).hide();

			//Show link button
			jQuery(this.acbutton_link.getDOMNode()).show();

			//Hide link
			jQuery(this.aclink.getDOMNode()).hide();

			//Hide entry
			jQuery(this.acentry.getDOMNode()).hide();

		},
		doShowSearch: function (only_search = false) {
			//alert('show search');

			//Hide listbox
			jQuery(this.acbox2.getDOMNode()).hide();
			//this.aclistbox.style.display = 'none';

			//Make sure select button is hidden at first
			jQuery(this.acbutton_select.getDOMNode()).hide();

			//Hide search button
			jQuery(this.acbutton_search.getDOMNode()).hide();
			//alert(this.aclistbox.options.select_options.length);
			//Show select button if listbox has options
			if (this.should_hide_listbox() === true || only_search === true ) {
				jQuery(this.acbutton_select.getDOMNode()).hide();
			} else {
				jQuery(this.acbutton_select.getDOMNode()).show();
			}
			//Show link button
			jQuery(this.acbutton_link.getDOMNode()).show();

			//Hide link
			jQuery(this.aclink.getDOMNode()).hide();

			//Show entry
			jQuery(this.acentry.getDOMNode()).show();


		},
		doShowLink: function () {

			//Hide listbox
			jQuery(this.acbox2.getDOMNode()).hide();

			//Show select button if listbox has options
			if (this.should_hide_listbox() === true) {
				jQuery(this.acbutton_select.getDOMNode()).hide();
				jQuery(this.acbutton_search.getDOMNode()).show();
			} else {
				jQuery(this.acbutton_select.getDOMNode()).show();
				jQuery(this.acbutton_search.getDOMNode()).hide();
			}

			//Show link
			jQuery(this.aclink.getDOMNode()).show();

			//Hide entry
			jQuery(this.acentry.getDOMNode()).hide();

			//Hide tick button
			jQuery(this.acbutton_link.getDOMNode()).hide();

		},
		should_hide_listbox: function () {
			//console.log('listbox_'+this.options.id.toString()+' check hide autohide:'+ this.options.listbox_autohide.toString() + 'length: ' + this.aclistbox.options.select_options.length);

			if (this.options.listbox_autohide === true) {

				//alert('in auto hide');

				if (this.aclistbox.options.select_options.length < 2 || typeof this.aclistbox.options.select_options.length === 'undefined') {
					//console.log('I will hide listbox_'+this.options.id.toString())
					//alert ('i will hide');
					//alert('listbox_'+this.options.id.toString()+' will be hidden');
					return true;
				}
			}

			return false;
		},

		onchange: function () {
			/*
			 if ( typeof this._super !== 'undefined' ){
			 this._super.apply( this, arguments );
			 }

			 if ( this.get_value () ) {

			 this.aclink.set_value( {
			 id: this.get_value().toString(),
			 app: this.options.only_app.toString()
			 });

			 jQuery(this.acbutton_show.getDOMNode()).show();

			 } else {
			 jQuery(this.acbutton_show.getDOMNode()).hide();
			 }
			 */
			//now run the on change fuction definded in the widget
			if (this.options.onEntryChange) {

				this.executeFunctionByName(this.options.onEntryChange, window);
			}
		},

		//https://stackoverflow.com/questions/359788/how-to-execute-a-javascript-function-when-i-have-its-name-as-a-string
		executeFunctionByName: function (functionName, context /*, args */) {
			var args = Array.prototype.slice.call(arguments, 2);
			var namespaces = functionName.split(".");
			var func = namespaces.pop();
			for (var i = 0; i < namespaces.length; i++) {
				context = context[namespaces[i]];
			}
			return context[func].apply(context, args);
		}



	});
}).call(this);
et2_register_widget(et2_aclink, ["aclink"]);
