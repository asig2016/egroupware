/*egw:uses
	et2_widget_link;
	/vendor/bower-asset/jquery/dist/jquery.js;
	/vendor/bower-asset/jquery/dist/jquery-ui.js;
    /vendor/vakata/jstree/dist/jstree.js;
*/

/**
 * Class which creates a TREE from jQuery jstree
 *
 * @augments et2_link_entry
 */
var et2_actree = (function(){ "use strict"; return et2_link_entry.extend({
	attributes: {
		"button_label": {
			"name": "Label",
			"type": "string",
			"default": "...",
			"description": "Label for button"
		},
		"dialog_width": {
			"name": "Dialog Width",
			"type": "string",
			"default": "200",
			"description": "Width for Dialog"
		},
		"dialog_height": {
			"name": "Dialog Height",
			"type": "string",
			"default": "200",
			"description": "Height for Dialog"
		},
		"show_search": {
			"name": "Show Search",
			"type": "boolean",
			"default": "1",
			"description": "Show Search"
		},
		"show_controls": {
			"name": "Show Controls",
			"type": "boolean",
			"default": "1",
			"description": "Show Collapse and Expand buttons"
		},
		"nodeCallback": {
			"name": "Node Callback",
			"type": "string",
			"default": "achelper.achelper_base.ajax_loadTreeNodes",
			"description": "Ajax function. Loads one tree level at a time, based on node_id given. Copy from achelper and implement your own"
		},
		"contextCallback": {
			"name": "Context Menu Callback",
			"type": "string",
			"default": "",
			"description": "JS function that must return an array of item objects. Documentation here https://www.jstree.com/api/#/?q=$.jstree.defaults.contextmenu&f=$.jstree.defaults.contextmenu.items"

		}
	},

    createInputWidget: function() {
		this._super.apply( this, arguments );


		// Create 'Open' Button
        this.acbutton = et2_createWidget('button', {label: this.egw().lang( this.options.button_label ), onclick: this.modalOpen.bind(this)}, this);

		// Create Tree Modal
		this.acbox = et2_createWidget('box', { class: 'hidden' }, this )

		if (this.options.show_controls) {
			et2_createWidget('button', { onclick: this.treeExpand.bind(this), label: '+' }, this.acbox );
			et2_createWidget('button', { onclick: this.treeCollapse.bind(this), label: '-' }, this.acbox );
		}
		if (this.options.show_search) {
			this.acsearch = et2_createWidget('textbox', { onchange: this.treeSearch.bind(this) }, this.acbox );
		}

        this.acbox1 = et2_createWidget('box', { class:'tree tree-default' }, this.acbox );
        this.acbox2 = et2_createWidget('box', { id: this.options.id +'_tree' }, this.acbox1 );
		if ( !this.options.readonly ){
			et2_createWidget('button', { onclick: this.treeSelectClose.bind(this), label: this.egw().lang('Ok') }, this.acbox);
		}
		et2_createWidget('button', { onclick: this.modalClose.bind(this), label: this.egw().lang('Cancel') }, this.acbox );

		var that = this;
		var configuration = {
			"core" : {
				'data' : function( node, callback ) {
					// Get children of node [node.id] to fill tree data
					egw.json( that.options.nodeCallback, [ node.id, that.options.value ], function( response ) {
						callback.call( this, response.nodes );
						if ( node.id == '#' && that.options.value ) {
							that.actree.jstree().load_node( response.parents, that.treeSetSelected.bind(that) );
						}
					}).sendRequest(true);

				},
				//TODO make multiple
				'multiple': false,
				'worker': false
			},
			'height': this.options.dialog_height,
			'width': this.options.dialog_width,
			'plugins': [],

		}
		if (this.options.search) {
			configuration.plugins.push('search');
			configuration.search = {
				'show_only_matches': true,
			};
		}
		if (this.options.contextCallback && typeof eval(this.options.contextCallback) === 'function') {
			configuration.plugins.push('contextmenu');
			configuration.contextmenu = {
				'items': eval(this.options.contextCallback)
			};
		}

        this.actree = jQuery( this.acbox2.getDOMNode() ).jstree(configuration);
	},
	destroy: function() {
		// Unbind event when destroying object
		// Otherwise, when the page is refreshed a new event is generated with the same uid
		// so the old one is called instead with a null "this"
		jQuery(document).off("dblclick", '#'+this.getDOMNode().id+"_tree li a");
        this._super.apply( this, arguments );
	},
	doLoadingFinished: function() {
		if ( !this.options.readonly ) {
			if ( this.get_value () ) {

				// Define readonly link
				this.aclink = et2_createWidget('link', {id: this.options.id,  readonly: this.options.readonly}, this);
				this.aclink.set_value({ id: this.get_value(), app: this.options.only_app, title: '#'+this.get_value() });
			}
			//jsTree doesn't support double click, bind it with jQuery
			jQuery(document).on("dblclick", '#'+this.getDOMNode().id+"_tree li a", jQuery.proxy(this.treeSelectClose, this) );
		}
		else {
			// Show link-entry_ro if readonly
			et2_createWidget('link', {id: this.options.id, only_app: this.options.only_app, readonly: this.options.readonly}, this);
			// Hide actual link
			this.search.hide();
			this.clear.remove();

			// Readonly functionality is preserved
		}

		return this._super.apply(this,arguments);
	},
	modalOpen: function() {
		jQuery(this.acbox.getDOMNode()).dialog();
	},
	modalClose: function() {
		jQuery(this.acbox.getDOMNode()).dialog('close');
	},
	treeCollapse: function() {
		this.actree.jstree().close_all();
	},
	treeExpand: function() {
		this.actree.jstree().open_all();
	},
	treeSearch: function( element, widget ) {
		// Search Open tree
		this.actree.jstree("deselect_all");
		var text = widget.getValue().toUpperCase();
		this.actree.jstree().search(text);
	},
	treeSelectClose: function() {

		var selected = this.actree.jstree().get_selected(true);
		//TODO make multiple
		selected = selected[0];

		if ( selected.data.selectible ) {
			this.set_value( selected.id );
			jQuery(this.acbox.getDOMNode()).dialog('close');
		}
	},
	treeSetSelected: function() {
		// Select link value inside tree
		this.actree.jstree().select_node( this.get_value() );
	},
});}).call(this);
et2_register_widget(et2_actree, ["actree"]);
