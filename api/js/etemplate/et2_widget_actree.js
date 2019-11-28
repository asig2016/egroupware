/*egw:uses
	et2_widget_link;
	/vendor/bower-asset/jquery/dist/jquery.js;
	/vendor/bower-asset/jquery/dist/jquery-ui.js;
    /achelper/vendor/vakata/jstree/dist/jstree.min.js;
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
        delayFocus          : {
            name                : "Delay Selected Node Focus Display ",
            type                : "integer",
            "default"           : 400,
            description         : `Focuses on a selected node after some time. The delay here allows the content to be
                                  rendered first and then move scroll to the given location.`
        },
        delaySearch         : {
            name                : "Delay Key Input For fetching results",
            type                : "integer",
            "default"           : 400,
            description         : `Usable by default search plugin or if you have an ajax call. On the latter you
                                  shouldn't bombard your server with requests until something is ready to be sent.`
        },
        onSubmitCallback    : {
            name                : "After Submit(Click Ok or Double Click) Callback",
            type                : "string",
            "default"           : null,
            description         : `Provide means for setting up additional UI/UX on other DOM elements outside the tree.
                                  It will use the data already existing on the given node.`
        },
        paramsCallback      : {
            name                : "Parameters Callback for the nodeCallback",
            type                : "string",
            "default"           : null,
            description         : `Additional request parameters needed to form the result from the nodeCallback. Use
                                  comma separated fields.`
        },
        nodeCallback        : {
            name                : "Node Callback",
            type                : "string",
            "default"           : "achelper.achelper_base.ajax_loadTreeNodes",
            description         : `Ajax function. Loads one tree level at a time, based on node_id given. Copy from
                                  achelper and implement your own`
        },
        contextCallback     : {
            name                : "Context Menu Callback",
            type                : "string",
            "default"           : "",
            description         : `JS function that must return an array of item objects. Documentation here
                                  https://www.jstree.com/api/#/?q=$.jstree.defaults.contextmenu&f=$.jstree.defaults.contextmenu.items`
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
     * JsTree Search Results Node
     *
     * This node will be added at the top of the tree. It will always be disabled unless a search is performed. The
     * content of the node depends if the search module is enabled, thus we will use the custom event to add all results
     * within it, or use a custom AJAX callback. The latter should fetch all missing results, in addition it should
     * render all missing nodes from the tree, that means that it should build recursively all those parents that have
     * not been opened yet.
     *
     * @access  public
     * @var     {@object} searchNode Node within the tree captured as jsTree Node object
     */
    searchNode : null,

    /**
     * Search jQuery Dom Element
     *
     * The input element to which we will place the key up event if the search options are enabled and active
     *
     * @access  public
     * @var     {@object} searchInput Text Input HTML tag
     */
    searchInput : null,

    /**
     * Additional parameters for the ajax callback
     *
     * Since there might be many more variables for the requested 
     *
     * @access  public
     * @var     {@array} params
     */
    params : [],

    /**
     * Qtip Parameters
     *
     * Position and style for the qtip(tooltip) element
     *
     * @access  public
     * @var     {@object} qtip
     */
    qtip : {
        suppress    : false,
        content     : {
            attr        : 'data-help',
        },
        position    : {
            my          : 'middle left',
            at          : 'middle right',
        },
        style: {
            classes     : 'qtip-green qtip-rounded qtip-shadow'
        }
    },

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
        // Create 'Open' Button
        this.acbutton = et2_createWidget('button', {label: this.egw().lang( this.options.button_label ), onclick: this.modalOpen.bind(this)}, this);
        return this._super.apply(this,arguments);
    },
    
    /**
     * Set a delay
     *
     * This method is used with a keyup triggered event on the input fields. Rather than displaying errors just
     * as we type, it takes given miliseconds time, performs the check and then sends the error
     *
     * @version 0.0.1
     * @access  public
     * @param   {function} fn Callback to run after the delay
     * @param   {integer} ms Miliseconds for the key up
     * @param   {integer} timer **Defaults to `null`**, in case that we do need to clean up last time out
     * @param   {array} ...args Variadic array for the arguments to bind on the selected function/method
     * @return  int
     */
    delay : (fn, ms, timer = null, ...args) => {
        if (timer) {
            clearTimeout(timer);
        }

        return setTimeout(fn.bind(this, ...args), ms);
    },

    /**
     * Run a callback
     *
     * Find the callback via its string name and run it from the parent object
     *
     * @version 0.0.1
     * @access  public
     * @param   {string} functionName Callback representation as a string
     * @param   {object} context Object containing the callback
     * @param   {array} args Arguments to use for the given callback
     * @return  mixed
     */
    fnByName : (functionName, context, args = []) => {
        // not tested
        // const it = ([x, ...xs], o = {} ) => xs.length === 0 || typeof (x) === 'function' ? x : (o[x] = it(xs,o[x]), o);
        // fn = it(name.split("."));
        // return fn(...args);

        var namespaces = functionName.split(".");
        var func = namespaces.pop();
        for (var i = 0; i < namespaces.length; i++) {
            context = context[namespaces[i]];
        }

        try {
            return context[func].apply(context, args);
        } catch (x) {
            console.info(`"${functionName}" is not a function`);
        }
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

        // couple of following lines provide the search tag and jstree search module
        this.searchCallbacks(this, 'el', controls);
        this.searchCallbacks(this, 'config');

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
                callback.call(this, response.nodes);
                
                if (response.expand && response.expand != 0) {
                    that.actree.open_all(response.expand);
                }

                if (response.selected) {
                    that.focusOnSelected(response.selected, that);
                }

                // creates the search node.
                that.searchCallbacks(that, 'node');
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
        if (!this.options.readonly) {
            this.aclink = et2_createWidget('link', {id: this.options.id,  readonly: this.options.readonly}, this);

            let gotValue = this.get_value();
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
     * > **Note**:  map will capture all those values that can be added for the tree node. Nodes that can be added
     *              **MUST** be formated as `\d+_anchor`. With that it assures, when having multiple structures
     *              folded the one within the other, to get the ones related to the data set you need and not any of
     *              the constructed parents.
     *
     * @version 0.0.3
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
                    // get only the last of the selected nodes
                    let map = that.actree.get_selected(true);
                    let l = map.length-1;
                    let c = map[l].data;
                    
                    // if the node is not allowed for usage, terminate here
                    if (c == undefined || typeof(c.isAllowed) === 'undefined' || c.isAllowed != 1) {
                        return;
                    }
                    
                    let idNode = map[l].id.replace(/[^\d]+/g, '');
                    
                    that.onSubmitCallback(that.actree.get_node(map[l]));
                    
                    that.set_value(idNode);
                    that.aclink.set_value({ id: idNode, app: that.options.only_app, title: `#${idNode}` });
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

                // try {
                    that.focusOnSelected(that.actree.get_selected()[0], that);
                // } catch (x) {
                //     // dummy
                // }
            },
            buttons : buttons
        });

        if (!this.options.readonly) {
            this.tree.off('dblclick', '.jstree-anchor').on(
                'dblclick', 
                '.jstree-anchor',
                this.modal.dialog('option', 'buttons')[0].click
            );
        }

        this.treeQtip();
        this.treeSelectedNodes();
    },

    /**
     * After Selecting A node
     *
     * When the selected node is to be used within the given application and it contains some data to be used allow it
     * to use data contained already within the node. That would will prevent extra interaction with the database.
     *
     * > **Note**:  Uses the very same method from et2_widget_aclink for fetching the content from any defined
     *              application.
     *
     * @version 0.0.1
     * @access  public
     * @param   {object} node Currently submitted node
     * @return  void
     * @see     https://stackoverflow.com/questions/359788/how-to-execute-a-javascript-function-when-i-have-its-name-as-a-string
     * @todo    Once merged with the aclink remove the closure. It is already contained into the aclink
     * @todo    Replace the given callback with something smaller and neater. You got plenty of examples for that
     */
    onSubmitCallback : function(node)
    {
        if (this.options.onSubmitCallback == null || typeof (node.data) === 'undefined') {
            return;
        }

        this.fnByName(this.options.onSubmitCallback, window, [node]);
    },

    /**
     * Tooltip event
     *
     * Adds a tooltip on the tree for each of the rendered nodes. This will be binded for all those a tag nodes that
     * do have css class `tooltip` and the content is encapsulated within `data-help` attribute,
     *
     * > **Note**:  for additional information how to setup qtip, css, position, events orientated please refer to the
     *              documentation {@link http://qtip2.com/options}
     *
     * @version 0.0.1
     * @access  public
     * @return  void
     */
    treeQtip : function()
    {
        let that    = this;

        this.tree.on('ready.jstree', function(e, data) {
            jQuery(this).find('a.tooltip').qtip(that.qtip);
        });

        this.tree.on('after_open.jstree', function(e, data) {
            let children = data.node.children;

            if (children == null || children.length === 0) {
                return;
            }

            children.reduce((a, i) => that.tree.find(`a#${i}_anchor.tooltip`).qtip(that.qtip));
        });
    },

    /**
     * Group All Search Methods
     *
     * Store all the methods that will define the search. All methods from the search tag to the search rendering
     * are placed in a single place.
     */
    searchCallbacks : (that, fn, ...args) => {
        if (!that.options.show_search) {
            return;
        }

        const objectLiterals = {
            // create the HTML search tag
            el      : (controls) => {
                that.searchInput = jQuery('<input />', {type: 'text'});
                controls.append(that.searchInput);
            },
            // set up jstree modules
            config  : () => {
                if (that.options.show_search !== '1') {
                    return;
                }

                that.jstreeConfig.plugins.push('search');
                that.jstreeConfig.search = {
                    show_only_matches : true
                };

                that.searchCallbacks(that, 'keyup');
            },
            // sets the keyup event for the HTML search tag
            keyup   : () => {
                that.searchInput.off('keyup').on('keyup', (event) => {
                    const rec = (c, v, t) => {
                        if (c == 27 || v == '') {
                            t.clear_search();
                            return;
                        }

                        t.search(v);
                    };

                    let timer = that.searchInput.data('timer');

                    that.searchInput.data(
                        'timer',
                        that.delay(
                            rec,
                            that.delaySearch,
                            timer,
                            event.which,
                            that.searchInput.val(),
                            that.actree
                        )
                    );
                });
            },
            // create the disabled search node on the tree
            node    : () => {
                if (that.searchNode != null) {
                    return;
                }

                let searchId = ['actree-search-node', (new Date().getTime()).toString(16)].join('-');
                that.actree.create_node(
                    '#',
                    {
                        id          : searchId,
                        text        : that.egw().lang('Search Results'),
                    },
                    'first'
                );
                
                that.searchNode = that.actree.get_node(searchId);
                that.actree.disable_node(that.searchNode);
                
                if (that.options.show_search !== '1') {
                    return;
                }

                that.searchCallbacks(that, 'events', that.actree, that.searchNode);
            },
            // triggers the search event. It will place all the nodes within the Search folder and open it
            events  : (t, sn) => {
                if (sn == null) {
                    return;
                }
                
                // removes all children nodes from the previous search
                const cleanUp = (t, sn) => sn.children.length > 0 ? t.delete_node(sn.children) : null;
        
                // for no search string or nothing to display
                that.tree.off('clear_search.jstree').on('clear_search.jstree', (e, data) => {
                    cleanUp(t, sn);
                    
                    data.instance.close_node(sn);
                    data.instance.disable_node(sn);
                });
        
                // for matching and not matched data
                that.tree.off('search.jstree').on('search.jstree', (e, data) => {
                    if (data.res === []) {
                        jQuery.trigger('clear_search.jstree');
                        return;
                    }
        
                    cleanUp(t, sn);
        
                    data.res.forEach((v, i) => {
                        if (v === sn.id) {
                            return;
                        }
        
                        let n = t.get_node(v);
                        
                        t.create_node(
                            sn.id,
                            {
                                id          : ['search', v].join('-'),
                                text        : n.text,
                                li_attr     : n.li_attr,
                                data        : n.data,
                            }
                        );
                    });

                    document.getElementById(sn.id).scrollIntoView();
                    data.instance.enable_node(sn);
                    data.instance.open_node(sn);
                });
            },
            // overides default search, use your ajax callback instead
            custom  : (...args) => {
                if (that.options.show_search === '1') {
                    return;
                }

                // let functionName = args[0];
                // this.fnByName(args[0], window)
            }
        }

        if (typeof (objectLiterals[fn]) !== 'function') {
            return;
        }

        objectLiterals[fn](...args);
    },

    /**
     * Selected Nodes Event Behaviours
     *
     * This will activate during the `changed` event. It will relate to the data that will be loaded per node as long
     * as it is allowed to be used/edited per registered this user.
     *
     * > **Note**:  Make sure that the isAllowed flag will be appropriately set via the permissions
     *
     * @version 0.0.1
     * @access  public
     * @return  void
     * @todo    Multiple selections are not implemented thus, this will return null for the momement.
     * @todo    Complete this part as it will provide all the data which will be passed per after a node selection.
     */
    treeSelectedNodes : function() {
        let that = this;

        this.tree.off('changed.jstree').on('changed.jstree', function(e, data) {
            let selected = data.selected;
            let allow = true;

            // get the first button from the given dialog, that is the "Ok" button
            let button = that.tree.closest('.ui-dialog-content').next('.ui-dialog-buttonpane.ui-widget-content').find('button:eq(0)');
            let l = selected.length;
            if (l === 0) {
                return;
            }

            let v = selected[l-1];
            let n = data.instance.get_node(v);
            let c = n.data;
            
            // to break the loop use return false, to iterate to the next node just return
            if (c == undefined || typeof(c.isAllowed) === 'undefined') {
                allow = false;
            } else {
                allow &= (c.isAllowed == '1' ? true : false);
            }

            if (allow) {
                button.removeClass('ui-state-disabled');
                button.removeAttr('disabled');
            } else {
                button.addClass('ui-state-disabled');
                button.attr('disabled', 'disabled');
            }
        });
    },

    /**
     * Move to selected Node,
     *
     * Scrolls and focuses to the last selection. If you open the widget for the first time it will focus on the
     * selected id.
     *
     * > **Note**:  It will delay before setting focus on the given node.
     *
     * @version 0.0.1
     * @access  public
     * @param   {string} idNode Node to focus on
     * @param   {object} parent The whole object(widget)
     * @param   {float} last The height for the given node
     * @param   {float} delay How long will wait before selecting the element
     * @return  void
     */
    focusOnSelected : (idNode, parent, last = -1, delay = null) => {
        if (idNode === undefined) {
            return;
        }

        if (delay == null) {
            delay = parent.delayFocus;
        }

        const rec = (id, p, last, delay) => {
            let node = parent.actree.get_node(id);

            if (node === false) {
                parent.focusOnSelected(id, p, last, delay);
                return;
            }

            if (!parent.actree.is_selected(id)) {
                parent.actree.select_node(id);
            }
            
            let el = document.getElementById(id);
            let rect = el.getBoundingClientRect();
            let top  = rect.top;

            if (last == top) {
                el.scrollIntoView();
                return;
            }

            parent.focusOnSelected(id, p, top, delay/2);
        };

        // in order of appearence, method, delay, timer if we need to destroy the timeout, the rest are the method
        // arguments
        parent.delay(rec, delay, null, idNode, parent, last, delay);
    },
});}).call(this);
et2_register_widget(et2_actree, ["actree"]);
