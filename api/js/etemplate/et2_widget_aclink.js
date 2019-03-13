/*egw:uses
	et2_widget_link;
	/vendor/bower-asset/jquery/dist/jquery.js;
	/vendor/bower-asset/jquery/dist/jquery-ui.js;
*/

/**
 * Class which creates a TREE from jQuery jstree
 *
 * @augments et2_link_entry
 */
var et2_aclink = (function(){ "use strict"; return et2_link_entry.extend({
	attributes: {
		"icon_width": {
			"name": "Dialog Width",
			"type": "string",
			"default": "16",
			"description": "Width for Icon"
		},
		"icon_height": {
			"name": "Dialog Height",
			"type": "string",
			"default": "16",
			"description": "Height for Icon"
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
		}

	},

    createInputWidget: function() {
		this._super.apply( this, arguments );

		// Create clickable application icon
        this.acbutton = et2_createWidget('appicon', { src: this.options.only_app, class: "widget_aclink", align: "center", height: this.options.icon_height, width: this.options.icon_width, label: "Click here to open link in new tab.", onclick: this.openEditInTab.bind(this)}, this);


		this.acbutton_edit = et2_createWidget('button', { image: "edit", class: "widget_aclink", align: "center", height: this.options.icon_height, width: this.options.icon_width, label: "Click here to edit field.", onclick: this.doEditLink.bind(this)}, this);
		this.acbutton_show = et2_createWidget('button', { image: "tick", class: "widget_aclink", align: "center", height: this.options.icon_height, width: this.options.icon_width, label: "Click here to show link.", onclick: this.doShowLink.bind(this)}, this);
		this.aclink = et2_createWidget('link-entry_ro', {id: this.options.id, only_app: this.options.only_app, class: this.options.id+"aclink", link_hook: this.options.link_hook, target_app: this.options.target_app}, this);
	},
	destroy: function() {
		// Unbind event when destroying object
		// Otherwise, when the page is refreshed a new event is generated with the same uid
		// so the old one is called instead with a null "this"
        this._super.apply( this, arguments );
	},
	doLoadingFinished: function() {

		if ( !this.options.readonly ) {
			if ( this.get_value() ) {
				//When field has value, show link and hide show-button
				this.doShowLink();
			}else {
				//When field has now value show textbox for input an hide edit button
				this.doEditLink();
			}
		}
		else {
			// Hide controls if readonly
			this.search.hide();
			this.clear.remove();
			jQuery(this.acbutton_show.getDOMNode()).hide();
			jQuery(this.acbutton_edit.getDOMNode()).hide();
		}

		return this._super.apply(this,arguments);
	},

	openEditInTab: function() {

		if ( this.get_value () ) {

			var params = {
				ajax: 'true',
			}

			params.menuaction = this.options.only_app.toString()+'.'+this.options.only_app.toString()+'_ui.edit';
			params.id = this.get_value().toString();
			/*Hack to use with infolog */
			params.info_id = this.get_value().toString();
			params.hidemenus = 'true';
			window.open(egw.link('/index.php', params), '_blank');

		}
		else{
			alert(egw.lang("No entry selected, can't open tab"));
		}

	},

	doEditLink: function(){
		// Show Editable
		this.search.show();
		this.clear.show();
		this.clear.css('visibility','visible');
		jQuery(this.acbutton_show.getDOMNode()).show();

		// Hide readonly
		jQuery(this.acbutton_edit.getDOMNode()).hide();
		jQuery(this.aclink.getDOMNode()).hide();
	},

	doShowLink: function(){
		// Hide Editable
		this.search.hide();
		this.clear.hide();
		this.clear.css('visibility','hidden');
		jQuery(this.acbutton_show.getDOMNode()).hide();

		// Show readonly
		jQuery(this.acbutton_edit.getDOMNode()).show();
		jQuery(this.aclink.getDOMNode()).show();
	},

	onchange: function(){
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

		//now run the on change fuction definded in the widget
		if (this.options.onEntryChange){
			this.executeFunctionByName(this.options.onEntryChange,window);
		}
	},

	//https://stackoverflow.com/questions/359788/how-to-execute-a-javascript-function-when-i-have-its-name-as-a-string
	executeFunctionByName:function (functionName, context /*, args */) {
	  var args = Array.prototype.slice.call(arguments, 2);
	  var namespaces = functionName.split(".");
	  var func = namespaces.pop();
	  for(var i = 0; i < namespaces.length; i++) {
		context = context[namespaces[i]];
	  }
	  return context[func].apply(context, args);
	}



});}).call(this);
et2_register_widget(et2_aclink, ["aclink"]);
