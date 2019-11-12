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

    /**
     * Shorthand Property
     *
     * Holds jstree methods and functions. This is generated right after the modal is opened
     *
     * @access  public
     * @var     function actree
     */
    actree       : null,

    /**
     * jstree Configuration Parameters
     *
     * The object initialized here will provide how the given tree will be displayed and behave.
     *
     * @access  public
     * @var     function jsTreeConfig
     */
    jstreeConfig : {
        'core'      : {
            'data'      : null,
            'multiple'  : false,
            'worker'    : false
        },
        'height'    : 0,
        'width'     : 0,
        'plugins'   : [],
    },

    /**
     * Widget Generator
     *
     * Adds all those DOM nodes and events related to those nodes within loaded DOM. All available options or else
     * tag attributes are defined in {@see et2_actree.attributes}. Moreover builds up related jstree configuration based
     * on the widget properties BUT it does not render it unless the modal is opened
     *
     * @version 0.0.1
     * @access  public
     * @return  void
     */
    createInputWidget: function() {
		this._super.apply( this, arguments );

		// Create 'Open' Button
        this.acbutton = et2_createWidget('button', {label: this.egw().lang( this.options.button_label ), onclick: this.modalOpen.bind(this)}, this);

		// // Create Tree Modal
		// this.acbox = et2_createWidget('box', {class: 'hidden'}, this);

		// if (this.options.show_controls) {
		// 	et2_createWidget('button', {onclick: this.treeExpand.bind(this), label: '+' }, this.acbox);
		// 	et2_createWidget('button', {onclick: this.treeCollapse.bind(this), label: '-'}, this.acbox);
		// }
		// if (this.options.show_search) {
		// 	this.acsearch = et2_createWidget('textbox', { onchange: this.treeSearch.bind(this) }, this.acbox );
		// }

        // this.acbox1 = et2_createWidget('box', { class:'tree tree-default' }, this.acbox );
        // this.acbox2 = et2_createWidget('box', { id: `${this.options.id}_tree`}, this.acbox1 );
        // if (!this.options.readonly) {
        //     et2_createWidget('button', { onclick: this.treeSelectClose.bind(this), label: this.egw().lang('Ok') }, this.acbox);
        // }
        
        // et2_createWidget('button', {onclick: this.modalClose.bind(this), label: this.egw().lang('Cancel')}, this.acbox );

        // this.jstreeConfig.height = this.options.dialog_height;
        // this.jstreeConfig.width = this.options.dialog_width;

        // if (this.options.show_search) {
        //     this.jstreeConfig.plugins.push('search');
        //     this.jstreeConfig.search = {
        //         show_only_matches : true
        //     };
        // }

        // if (this.options.contextCallback) {
        //     let evalContextCallback = eval(this.options.contextCallback);
        //     if (typeof(evalContextCallback) === 'function') {
        //         this.jstreeConfig.core.check_callback = true;
        //         this.jstreeConfig.plugins.push('contextmenu');
        //         this.jstreeConfig.contextmenu = {
        //             items : evalContextCallback
        //         };
        //     }
        // }

        // let that = this;

        // this.jstreeConfig.core.data = function(node, callback) {
        //     // no need to recall the same nodes more than once
        //     if (that.actree != null && that.actree.is_parent(node) && node.children.length > 0) {
        //         return;
        //     }

        //     egw.json(that.options.nodeCallback, [node.id, that.options.value], function(response) {
        //         callback.call(this, response.nodes);
        //         that.createJsTree();
        //         that.actree.load_node(response.parents, that.treeSetSelected.bind(that));
        //     }).sendRequest(true);
        // };
    },
    
    modal : null,
    tree  : null,

    jQueryWidget: function()
    {
        if (this.modal != null) {
            return;
        }

        let that = this;

        this.modal = jQuery('<div />', {id : 'treeModal', 'class' : 'hidden'});
        let controls = jQuery('<div />', {'class':'display-block'});
        let buttonExpand  = jQuery('<button />', {'class':'primary'}).html('+').off('click').on('click', function() {
            that.actree.open_all();
        });
        let buttonCollapse = jQuery('<button />', {'class':'primary'}).html('-').off('click').on('click', function() {
            that.actree.close_all();
        });
        
        controls.append(buttonExpand).append(buttonCollapse);
        if (this.options.show_search) {
            let searchInput = jQuery('<input />', {type: 'text'}).off('keyup').on('keyup', this.treeSearch);
            controls.append(searchInput);
        }
        
        this.tree = jQuery('<div />', {'class': 'tree tree-default display-block'});

        // this.node = jQuery('<div />', {id : `${that.options.id}_tree`})
        // tree.append(this.node);
        
        let footer = jQuery('<div />', {'class':'display-block'});
        if (!this.options.readonly) {
            let buttonOk = jQuery('<button />', {'class':'primary'}).html(this.egw().lang('Ok')).off('click').on('click', function() {
                that.actree.get_selected(true).forEach((v) => that.set_value(v.id));
                that.modal.dialog('close');
            });
            footer.append(buttonOk);
        }
        let buttonCancel = jQuery('<button />', {'class':'primary'}).html(this.egw().lang('Cancel')).off('click').on('click', function() {
            that.modal.dialog('close');
        });
        footer.append(buttonCancel);

        this.modal.append(controls).append(this.tree).append(footer);
        jQuery('body').append(this.modal);

        this.jstreeConfig.height = this.options.dialog_height;
        this.jstreeConfig.width = this.options.dialog_width;

        if (this.options.show_search) {
            this.jstreeConfig.plugins.push('search');
            this.jstreeConfig.search = {
                show_only_matches : true
            };
        }

        if (this.options.contextCallback) {
            let evalContextCallback = eval(this.options.contextCallback);
            if (typeof(evalContextCallback) === 'function') {
                this.jstreeConfig.core.check_callback = true;
                this.jstreeConfig.plugins.push('contextmenu');
                this.jstreeConfig.contextmenu = {
                    items : evalContextCallback
                };
            }
        }

        this.jstreeConfig.core.data = function(node, callback) {
            // no need to recall the same nodes more than once
            if (that.actree != null && that.actree.is_parent(node) && node.children.length > 0) {
                return;
            }

            egw.json(that.options.nodeCallback, [node.id, that.options.value], function(response) {
                callback.call(this, response.nodes);
                that.createJsTree();
                that.actree.load_node(response.parents, that.treeSetSelected.bind(that));
            }).sendRequest(true);
        };

        this.createJsTree();
    },

    /**
     * Remove Events Or Nodes
     *
     * Set here the content that you wish to unbind from the DOM. In this case we do remove the double click event
     * binded by opening and when the dialog is opened.
     *
     * @version 0.0.2
     * @access  public
     * @return  void
     */
	destroy: function() {
        let domNodes = this.getDOMNode();
		jQuery(document).off("dblclick", `#${domNodes.id}_tree li a, #${domNodes.id}_tree li span.edit_link`);
        this._super.apply(this, arguments);
    },
    
    /**
     * Generate Template
     *
     * Generates those events required for setting up the template into related positions. It does not initaliaze the
     * construction of the tree. The tree is created only and when you open the modal.
     *
     * @version 0.0.2
     * @access  public
     * @return  void
     */
	doLoadingFinished: function() {
        let domNodes = this.getDOMNode();
        let gotValue = this.get_value();
    
        if (!this.options.readonly) {
			if (gotValue) {
				this.aclink = et2_createWidget('link', {id: this.options.id,  readonly: this.options.readonly}, this);
				this.aclink.set_value({ id: gotValue, app: this.options.only_app, title: `#${gotValue}` });
			}
			jQuery(document).on("dblclick", `#${domNodes.id}_tree li a, #${domNodes.id}_tree li span.edit_link`, jQuery.proxy(this.treeSelectClose, this));
			// jQuery(document).on("dblclick", `#${domNodes.id}_tree li span.edit_link`, jQuery.proxy(this.treeSelectClose, this));
		} else {
			// Show link-entry_ro if readonly
			et2_createWidget('link', {id: this.options.id, only_app: this.options.only_app, readonly: this.options.readonly}, this);
			// Hide actual link
			this.search.hide();
			this.clear.remove();
		}

		return this._super.apply(this,arguments);
    },
    
    /**
     * Create JSTree Object
     *
     * Creates the object used for the widget.
     *
     * @version 0.0.1
     * @access  public
     * @return  void
     */
    createJsTree: function()
    {
        if (this.actree != null) {
            return;
        }

        // this.actree = jQuery(this.acbox2.getDOMNode()).jstree(this.jstreeConfig);
        this.actree = this.tree.jstree(this.jstreeConfig);
        this.actree = this.tree.jstree(true);
    },

    /**
     * Modal Event
     *
     * Set up an event within the modal that will generate required jstree. Moreover once done with with the loading
     * make public object property {@see et2_actree.actree} as jstree shorthand.
     *
     * @version 0.0.2
     * @access  public
     * @return  void
     */
	modalOpen: function() {
        this.jQueryWidget();

        let that = this;

        // jQuery(this.acbox.getDOMNode()).dialog({
        this.modal.dialog({
            open: function(event, ui) {
                jQuery(this).removeClass('hidden');
            },
            close: function(event, ui) {
                that.actree = null;
                that.tree   = null;
                that.modal  = null;
            }
        });
    },
    
    /**
     * Close and destroy
     *
     * Remove all the previous element nodes. That will make sure that the content will be reloaded once again when
     * and whenever is needed.
     *
     * @version 0.0.2
     * @access  public
     * @return  void
     */
    modalClose: function() {
        this.modal.dialog('close', function() {
            this.actree = null;
            this.tree   = null;
            this.modal  = null;
        });
    },

    treeCollapse: function() {
        this.actree.close_all();
    },
    
    treeExpand: function() {
        this.actree.open_all();
    },
    
    /**
     * Performs Words Search
     *
     * It searches for matches of words, keywords or anything else within the innerHTML of all nested DOM objects right
     * after they have been rendered.
     *
     * @version 0.0.1
     * @param   {object} element
     * @param   {object} widget
     * @return  void
     * @todo    Replace this with all related fields. Do not amend or setup the search, just provide the content
     *          directly from the ajax callback.
     */
    treeSearch: function(element, widget) {
        // this.actree.jstree("deselect_all");
        let text = widget.getValue().toUpperCase();
        this.actree.search(text);
    },

    /**
     * Ok Event
     *
     * Captures selected node and closes the dialog. This event is also triggered if you double click.
     *
     * @version 0.0.2
     * @access  public
     * @return  void
     */
    treeSelectClose: function() {
        this.actree.get_selected(true).forEach((v) => this.set_value(v.id));
        this.modal.dialog('close');
        // jQuery(this.acbox.getDOMNode()).dialog('close');
    },

    /**
     * Tree Click Event
     *
     * Sets the selected node into DOM's data container.
     *
     * @version 0.0.2
     * @access  public
     * @return  void
     */
	treeSetSelected: function() {
        this.actree.select_node(this.get_value());
	},
});}).call(this);
et2_register_widget(et2_actree, ["actree"]);
