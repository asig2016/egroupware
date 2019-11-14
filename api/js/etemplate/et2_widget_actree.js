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
		"dialog_title": {
			"name": "Dialog Width",
			"type": "string",
			"default": "Actions Modal",
			"description": "Dialog Title"
		},
		"dialog_width": {
			"name": "Dialog Width",
			"type": "integer",
			"default": 200,
			"description": "Width for Dialog"
		},
		"dialog_height": {
			"name": "Dialog Height",
			"type": "integer",
			"default": 200,
			"description": "Height for Dialog"
		},
		"show_search": {
			"name": "Show Search",
			"type": "boolean",
			"default": "1",
			"description": "Show Search, you can set a callback instead."
		},
		"show_controls": {
			"name": "Show Controls",
			"type": "boolean",
			"default": "1",
			"description": "Show Collapse and Expand buttons"
		},
        "paramsCallback": {
            "name": "Parameters Callback for the nodeCallback",
            "type": "string",
            "default": "null",
            "description": "Additional request parameters needed to form the result from the nodeCallback. Use comma separated fields."
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
     * Modal Element
     *
     * Place the modal element on this node. The content here will be a jQuery DOM node
     *
     * @access  public
     * @var     {object} modal
     */
    modal : null,

    /**
     * Tree Element
     *
     * After creating the modal place the tree element space within it. This node will hold the tree and it will be
     * yet another jQuery DOM node
     *
     * @access  public
     * @var     {object} tree
     */
    tree  : null,

    /**
     * Shorthand Property
     *
     * Holds jstree methods and functions. Is generated right after the modal is opened and we do assign the `this.tree`
     * properties via the jstree method.
     *
     * @access  public
     * @var     {object} actree
     */
    actree : null,

    /**
     * Additional parameters for the ajax callback
     *
     * Since there might be many more variables for the requested 
     */
    params : [],

    /**
     * jstree Configuration Parameters
     *
     * The object initialized here will provide how the given tree will be displayed and behave.
     *
     * @access  public
     * @var     {object} jsTreeConfig
     */
    jstreeConfig : {
        'core'      : {
            'data'      : null,
            'multiple'  : false,
            'worker'    : false
        },
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
        // this._super.apply( this, arguments );

        // Create 'Open' Button
        this.acbutton = et2_createWidget('button', {label: this.egw().lang( this.options.button_label ), onclick: this.modalOpen.bind(this)}, this);
        return this._super.apply(this,arguments);
    },
    
    /**
     * Tree Widget
     *
     * Creates via javascript all the elements for the modal content. After that it sets all those required binds on
     * the elements and generates the tree node.
     *
     * @version 0.0.1
     * @access  public
     * @return  void
     */
    jQueryWidget: function()
    {
        if (this.modal != null) {
            return;
        }

        let that = this;

        this.modal      = jQuery('<div />', {'class' : 'hidden'});
        let controls    = jQuery('<div />', {'class':'display-block'});
        
        let buttonExpand  = jQuery('<button />', {'class':'primary'}).html('+').off('click').on('click', function() {
            that.actree.open_all();
        });
        let buttonCollapse = jQuery('<button />', {'class':'primary'}).html('-').off('click').on('click', function() {
            that.actree.close_all();
        });
        
        controls.append(buttonExpand, buttonCollapse);
        
        this.tree = jQuery('<div />', {'class': 'tree tree-default display-block'});

        this.modal.append(controls, this.tree);
        jQuery('body').append(this.modal);

        if (this.options.show_search) {
            let showSearch = function(event) {
                that.tree.jstree('deselect_all');
                that.actree.search(jQuery(this).val());
            };

            let evalShowSearch;

            try {
                evalShowSearch = eval(this.options.show_search);

                if (typeof(evalShowSearch) !== 'function') {
                    evalShowSearch = showSearch;
                }
            } catch (x) {
                evalShowSearch = showSearch;
            }

            let searchInput = jQuery('<input />', {type: 'text'}).off('keyup').on('keyup', evalShowSearch);
            controls.append(searchInput);

            this.jstreeConfig.plugins.push('search');
            this.jstreeConfig.search = {
                show_only_matches : true
            };
        }

        if (typeof(this.options.paramsCallback) === 'string') {
            let evalParams = eval(this.options.paramsCallback);
            this.params = typeof(evalParams) === 'function' ? evalParams() : [];
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

        /**
         * Get Response
         *
         * This is bit tricky as it needs to verify, before sending a request and send that request once, that;
         * - the tree is generated,
         * - the node to fetch is a parent and
         * - the parent is not an array, meaning that all its children have already been added.
         *
         * It gets more tricky when the data to fetch does not rely on the default structure the jstree relies upon.
         * For that reason `this.options.paramsCallback` has been introduced. Make sure that the callback returns an
         * array and has no arguments.
         * The parameters if defined are properly set up into an aforementioned conditional statement that converts the
         * string to array and replaces all those key names with the actual required values.
         *
         * @version 0.0.3
         * @access  public
         * @param   {object} node
         * @param   {function} callback
         * @return  void
         */
        this.jstreeConfig.core.data = function(node, callback) {
            // no need to recall the same nodes more than once
            if (that.actree != null && that.actree.is_parent(node) && node.children.length > 0) {
                return;
            }

            egw.json(that.options.nodeCallback, [node.id, that.options.value].concat(that.params), function(response) {
                console.info(response);

                if (typeof(response.nodes) === undefined) {
                    return;
                }

                callback.call(this, response.nodes);
                that.actree.load_node(response.parents, that.treeSetSelected.bind(that));
            }).sendRequest(true);
        };

        // generate jstree
        this.actree = this.tree.jstree(this.jstreeConfig);
        // get the jstree object
        this.actree = this.tree.jstree(true);
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
        this.tree.off('dblclick', '.jstree-anchor');
        this._super.apply(this, arguments);
    },
    
    /**
     * Generate Link
     *
     * Generate the outer link in case that there is a parent.
     *
     * @version 0.0.3
     * @access  public
     * @return  void
     * @todo    Note that there is no way to set a null node right now. Need to figure a way to fix this. Probably,
     *          additional button? Probably null node on the tree?
     */
	doLoadingFinished: function() {
        let gotValue = this.get_value();
    
        if (!this.options.readonly) {
            this.aclink = et2_createWidget('link', {id: this.options.id,  readonly: this.options.readonly}, this);
            if (gotValue) {
                this.aclink.set_value({ id: gotValue, app: this.options.only_app, title: `#${gotValue}` });
            }
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
        let buttons = [];

        if (!this.options.readonly) {
            buttons.push({
                text    : this.egw().lang('Ok'),
                icon    : 'ui-icon-heart',
                click   : function() {
                    that.actree.get_selected(true).forEach((v) => that.set_value(v.id));
                    let newValue = that.get_value();
                    that.aclink.set_value({ id: newValue, app: that.options.only_app, title: `#${newValue}` });
                    that.modal.dialog('close');
                }
            });
        }

        buttons.push({
            text    : this.egw().lang('Cancel'),
            icon    : 'ui-icon-cancel',
            click   : function() {
                that.modal.dialog('close');
            }
        });

        this.modal.dialog({
            title   : this.options.dialog_title,
            width   : this.options.dialog_width,
            height  : this.options.dialog_height,
            open    : function(event, ui) {
                jQuery(this).removeClass('hidden');
            },
            buttons : buttons
        });

        if (!this.options.readonly) {
            this.tree.on(
                'dblclick', 
                '.jstree-anchor',
                this.modal.dialog('option', 'buttons')[0].click
            );
        }
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
