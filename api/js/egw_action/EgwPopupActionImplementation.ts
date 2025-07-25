/**
 * EGroupware egw_action framework - egw action framework
 *
 * @link https://www.egroupware.org
 * @author Andreas Stöckel <as@stylite.de>
 * @copyright 2011 by Andreas Stöckel
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 * @package egw_action
 */

import {_egw_active_menu, egwMenu, egwMenuItem} from "./egw_menu";
import {EGW_KEY_ENTER, EGW_KEY_MENU} from "./egw_action_constants";
import {tapAndSwipe} from "../tapandswipe";
import {EgwFnct} from "./egw_action_common";
import "./egwGlobal"
import {EgwActionImplementation} from "./EgwActionImplementation";
import {EgwActionObject} from "./EgwActionObject";
import {EgwPopupAction} from "./EgwPopupAction";
import {egw} from "../jsapi/egw_global";
import {FindActionTarget} from "../etemplate/FindActionTarget";

export class EgwPopupActionImplementation implements EgwActionImplementation {
    type = "popup";
    auto_paste = true;
    parent?: FindActionTarget //currently only implemented by Et2Tree

    registerAction = (_aoi, _callback, _context) => {
        const node = _aoi.getDOMNode();
		let parentNode = null;
		let parentAO = null;
		let isNew = false;

		// Is there a parent that handles action targets?
		if(typeof _context.findActionTargetHandler !== "undefined" && typeof _context.findActionTargetHandler?.iface?.getWidget == "function")
		{
			parentAO = _context.findActionTargetHandler;
			parentNode = parentAO.iface.getWidget();
		}
		if(!_aoi.findActionTargetHandler && parentNode && typeof parentNode.findActionTarget == "function")
		{
			_aoi.findActionTargetHandler = parentNode;
			isNew = true;
		}
		if(typeof _aoi.handlers == "undefined")
		{
			_aoi.handlers = {};
		}
		if(typeof _aoi.handlers[this.type] == "undefined")
		{
			_aoi.handlers[this.type] = [];
		}

		if(_aoi.handlers[this.type].length == 0)
		{
			_aoi.handlers[this.type].push({type: 'contextmenu', listener: _callback});
			if(isNew)
			{
				//if a parent is available the context menu Event-listener will only be bound once on the parent
				this._registerDefault(parentNode, _callback, parentAO);
				this._registerContext(parentNode, _callback, parentAO);

				return true;
			}
			else if(node && !parentNode)
			{
				this._registerDefault(node, _callback, _context);
				this._registerContext(node, _callback, _context);
				return true;
			}
		}
		return false;

	};

    unregisterAction = function (_aoi) {
        const node = _aoi.getDOMNode();
        //TODO jQuery replacement
        jQuery(node).off();

		// Unregister handlers
		if(_aoi.handlers)
		{
			_aoi.handlers[this.type]?.forEach(h => node.removeEventListener(h.type, h.listener));
			delete _aoi.handlers[this.type];
		}
        return true
    };

    /**
     * Builds the context menu and shows it at the given position/DOM-Node.
     *
     * @param {object} _context
     * @param {type} _selected
     * @param {type} _links
     * @param {type} _target
     * @returns {Boolean}
     */
    executeImplementation = (_context, _selected, _links, _target)=> {
        if (typeof _target == "undefined") {
            _target = null;
        }

        this._context = _context;
        if (typeof _context == "object" && typeof _context.keyEvent == "object") {
            return this._handleKeyPress(_context.keyEvent, _selected, _links, _target);
        } else if (_context != "default") {
            //Check whether the context has the posx and posy parameters
            if ((typeof _context.posx != "number" || typeof _context.posy != "number") &&
                typeof _context.id != "undefined") {
                // Calculate context menu position from the given DOM-Node
                let node = _context;

                const x = jQuery(node).offset().left;
                const y = jQuery(node).offset().top;

                _context = {"posx": x, "posy": y};
            }

			let menu = null;
			// Special handling for nextmatch context menu - reuse the same menu
			if(!_target && !_context.menu && _selected[0].parent.manager.data.menu)
			{
				menu = _selected[0].parent.manager.data.menu
			}
			if(this.auto_paste && !window.egwIsMobile() && (!this._context?.event || this._context?.event && !this._context.event?.type.match(/touch/)))
			{
				this._addCopyPaste(_links, _selected);
			}
			if(!menu)
			{
				menu = this._buildMenu(_links, _selected, _target);
			}
			else
			{
				menu.applyContext(_links, _selected, _target);
			}

			menu.showAt(_context.posx, _context.posy);

			return true;
        } else {
            const defaultAction = this._getDefaultLink(_links);
            if (defaultAction) {
                defaultAction.execute(_selected);
            }
        }

        return false;
    };

    /**
     * Registers the handler for the default action
     *
     * @param {any} _node
     * @param {function} _callback
     * @param {object} _context
     * @returns {boolean}
     */
    private _registerDefault =  (_node, _callback, _context)=> {
        const defaultHandler =  (e)=> {
            const x = _node
            //use different node and context for callback if event happens on parent
            let nodeToUse;
            let contextToUse;
            if (x.findActionTarget)
            {
                const y = x.findActionTarget(e);
                nodeToUse = y?.target;
                contextToUse = y?.action;
                e.originalEvent = e;

            }
            //allow bubbling of the expand folder event
            //do not stop bubbling of events if the event is supposed to be handled by the et2-tree
            if (window.egwIsMobile() && (nodeToUse || e.currentTarget).tagName == "SL-TREE-ITEM") return true;
            // a tag should be handled by default event
            // Prevent bubbling bound event on <a> tag, on touch devices
            if (window.egwIsMobile() && (nodeToUse || e.target).tagName == "A") return true;


            if (typeof document["selection"] != "undefined" && typeof document["selection"].empty != "undefined") {
                document["selection"].empty();
            } else if (typeof window.getSelection != "undefined") {
                const sel = window.getSelection();
                sel.removeAllRanges();
            }

            if (!
                ((contextToUse || _context).manager.getActionsByAttr('singleClick', true).length > 0 &&
                    (nodeToUse || e.target).classList.contains('et2_clickable')
                )
            )
            {
                _callback.call(contextToUse || _context, "default", this);
            }

            // Stop action from bubbling up to parents
            e.stopPropagation();
            e.cancelBubble = true;

            // remove context menu if we are in mobile theme
            // and intended to open the entry
            if (_egw_active_menu && e.which == 1) _egw_active_menu.hide();
            return false;
        };

        if (window.egwIsMobile() || _context.manager.getActionsByAttr('singleClick', true).length > 0) {
            _node.addEventListener('click',defaultHandler)//jQuery(_node).on('click', defaultHandler);
        } else {
            _node.ondblclick = defaultHandler;
        }
    };

    private _getDefaultLink = function (_links) {
        let defaultAction = null;
        for (const k in _links) {
            if (_links[k].actionObj["default"] && _links[k].enabled) {
                defaultAction = _links[k].actionObj;
                break;
            }
        }

        return defaultAction;
    };

    private _searchShortcut = (_key, _objs, _links) => {
        for (const item of _objs) {
            const shortcut = item.shortcut;
            if (shortcut && shortcut.keyCode == _key.keyCode && shortcut.shift == _key.shift &&
                shortcut.ctrl == _key.ctrl && shortcut.alt == _key.alt &&
                item.type == "popup" && (typeof _links[item.id] == "undefined" ||
                    _links[item.id].enabled)) {
                return item;
            }

            const obj = this._searchShortcut(_key, item.children, _links);
            if (obj) {
                return obj;
            }
        }
    };

    private _searchShortcutInLinks =  (_key, _links)=> {
        const objs = [];
        for (const k in _links) {
            if (_links[k].enabled) {
                objs.push(_links[k].actionObj);
            }
        }

        return this._searchShortcut(_key, objs, _links);
    };

    /**
     * Handles a key press
     *
     * @param {object} _key
     * @param {type} _selected
     * @param {type} _links
     * @param {type} _target
     * @returns {Boolean}
     */
    private _handleKeyPress = (_key, _selected, _links, _target) => {
        // Handle the default
        if (_key.keyCode == EGW_KEY_ENTER && !_key.ctrl && !_key.shift && !_key.alt) {
            const defaultAction = this._getDefaultLink(_links);
            if (defaultAction) {
                defaultAction.execute(_selected);
                return true;
            }
        }

        // Menu button
        if (_key.keyCode == EGW_KEY_MENU && !_key.ctrl) {
            return this.executeImplementation({posx: 0, posy: 0}, _selected, _links, _target);
        }


        // Check whether the given shortcut exists
        const obj = this._searchShortcutInLinks(_key, _links);
        if (obj) {
            obj.execute(_selected);
            return true;
        }

        return false;
    };

    private _handleTapHold = function (_node, _callback) {
        //TODO (todo-jquery): ATM we need to convert the possible given jquery dom node object into DOM Element, this
        // should be no longer necessary after removing jQuery nodes.
        if (_node instanceof jQuery) {
            _node = _node[0];
        }

        let tap = new tapAndSwipe(_node, {
            // this threshold must be the same as the one set in et2_dataview_view_aoi
            tapHoldThreshold: 1000,
            allowScrolling: "both",
            tapAndHold: function (event, fingercount) {
                if (fingercount >= 2) return;
                // don't trigger contextmenu if sorting is happening
                if (document.querySelector('.sortable-drag')) return;

                _callback(event);
            }
        });
        // bind a custom event tapandhold to be able to call it from nm action button
        _node.addEventListener('tapandhold', _event => {
            _callback(_event)
        });
    }

    /**
     * Registers the handler for the context menu
     *
     * @param {any} _node
     * @param {function} _callback
     * @param {object} _context
     * @returns {boolean}
     */
    private _registerContext = (_node, _callback, _context) => {

		// Special handling for nextmatch: only build the menu once and just re-use it.
		if(!_context.menu && _context.actionLinks && _context.parent?.manager?.data?.nextmatch && !_context.parent.manager.data.menu)
		{
			// Don't block load
			_context.parent.manager.data.menu = {}; // Set it to something or it will do this for every row
			window.setTimeout(() =>
			{
				_context.parent.manager.data.menu = this._buildMenu(_context.actionLinks, [_context], null);
				_context.parent.manager.data.menu.showAt(0, 0);
				_context.parent.manager.data.menu.hide();
			}, 0);
		}
        const contextHandler = (e) => {
            const x = _node
            //use different node and context for callback if event happens on parent
            let nodeToUse;
            let contextToUse;
            if (x.findActionTarget)
            {
                const y = x.findActionTarget(e);
                nodeToUse = y?.target;
                contextToUse = y?.action;
                e.originalEvent = e;
            }
            //Obtain the event object, this should not happen at any point
            if (!e) {
                e = window.event;
            }

			// Close any open tooltip so they don't get in the way
			egw(window).tooltipCancel();

            if (_egw_active_menu)
            {
                _egw_active_menu.hide();
            } else if (!e.ctrlKey && e.which == 3 || e.which === 0 || e.type === 'tapandhold') // tap event indicates by 0
            {
                const _xy = this._getPageXY(e);
                const _implContext = {
                    event: e, posx: _xy.posx,
                    posy: _xy.posy,
                    innerText: nodeToUse?.title || _node.innerText,//nodeToUse only exists on widgets that define findActionTarget
					target: nodeToUse || _node,
                };
                _callback.call(contextToUse || _context, _implContext, this);
            }

            e.cancelBubble = !e.ctrlKey || e.which == 1;
            if (e.stopPropagation && e.cancelBubble) {
                e.stopPropagation();
                e.preventDefault()
            }
            return !e.cancelBubble;
        };
        // Safari still needs the taphold to trigger contextmenu
        // Chrome has default event on touch and hold which acts like right click
        this._handleTapHold(_node, contextHandler);
        if (!window.egwIsMobile())
        {
            _node.addEventListener('contextmenu', contextHandler);
			_context.iface?.handlers['popup'].push({type: 'contextmenu', listener: contextHandler});
        }
    };

    /**
     * Groups and sorts the given action tree layer
     *
     * @param {type} _layer
     * @param {type} _links
     * @param {type} _parentGroup
     */
    private _groupLayers = (_layer, _links, _parentGroup) => {
        // Separate the multiple groups out of the layer
        const link_groups = {};

        for (let i = 0; i < _layer.children.length; i++) {
            const popupAction:EgwPopupAction = _layer.children[i].action;

            // Check whether the link group of the current element already exists,
            // if not, create the group
			const grp = popupAction.group ?? 999;
            if (typeof link_groups[grp] == "undefined") {
                link_groups[grp] = [];
            }

            // Search the link data for this action object if none is found,
            // visible and enabled = true is assumed
            let visible = true;
            let enabled = true;

            if (typeof _links[popupAction.id] != "undefined") {
                visible = _links[popupAction.id].visible;
                enabled = _links[popupAction.id].enabled;
            }

            // Insert the element in order
            let inserted = false;
            const groupObj = {
                "actionObj": popupAction,
                "visible": visible,
                "enabled": enabled,
                "groups": []
            };

            for (let j = 0; j < link_groups[grp].length; j++) {
                const elem:EgwPopupAction = link_groups[grp][j].actionObj;
                if (elem.order > popupAction.order) {
                    inserted = true;
                    link_groups[grp].splice(j, 0, groupObj);
                    break;
                }
            }

            // If the object hasn't been inserted, add it to the end of the list
            if (!inserted) {
                link_groups[grp].push(groupObj);
            }

            // If this child itself has children, group those elements too
            if (_layer.children[i].children.length > 0) {
                this._groupLayers(_layer.children[i], _links, groupObj);
            }
        }

        // Transform the link_groups object into a sorted array
        const groups = [];

        for (const k in link_groups) {
            groups.push({"grp": k, "links": link_groups[k]});
        }

        groups.sort(function (a, b) {
			const ia = parseFloat(a.grp);
			const ib = parseFloat(b.grp);
            return (ia > ib) ? 1 : ((ia < ib) ? -1 : 0);
        });

        // Append the groups to the groups2 array
        const groups2 = [];
        for (const item of groups) {
            groups2.push(item.links);
        }

        _parentGroup.groups = groups2;
    };

    /**
     * Build the menu layers
     *
     * @param {type} _menu
     * @param {type} _groups
     * @param {type} _selected
     * @param {type} _enabled
     * @param {type} _target
     */
    private _buildMenuLayer = (_menu, _groups, _selected, _enabled, _target) => {
        let firstGroup = true;

        for (const item1 of _groups) {
            let firstElem = true;

            // Go through the elements of each group
            for (const link of item1) {
                if (link.visible) {
                    // Add a separator after each group
                    if (!firstGroup && firstElem) {
                        _menu.addItem("", "-");
                    }
                    firstElem = false;

                    const item:egwMenuItem = _menu.addItem(link.actionObj.id, link.actionObj.caption,
                        link.actionObj.iconUrl, undefined, link.actionObj.color,link.actionObj?.data?.level);
                    item.default= link.actionObj["default"];

                    // As this code is also used when a drag-drop popup menu is built,
                    // we have to perform this check
                    if (link.actionObj.type == "popup") {
                        item.set_hint(link.actionObj.hint);
                        item.set_checkbox(link.actionObj.checkbox);
                        item.set_checked(link.actionObj.checked);
                        if (link.actionObj.checkbox && link.actionObj.isChecked) {
                            item.set_checked(link.actionObj.isChecked.exec(link.actionObj, _selected));
                        }
                        item.set_groupIndex(link.actionObj.radioGroup);

                        if (link.actionObj.shortcut && !window.egwIsMobile()) {
                            const shortcut = link.actionObj.shortcut;
                            item.set_shortcutCaption(shortcut.caption);
                        }
                    }

                    item.set_data(link.actionObj);
                    if (link.enabled && _enabled) {
                        item.set_onClick( (elem) => {
                            // Pass the context
                            elem.data.menu_context = this._context;

                            // Copy the "checked" state
                            if (typeof elem.data.checked != "undefined") {
                                elem.data.checked = elem.checked;
                            }

                            elem.data.execute(_selected, _target);

                            if (typeof elem.data.checkbox != "undefined" && elem.data.checkbox) {
                                return elem.data.checked;
                            }
                        });
                    } else {
                        item.set_enabled(false);
                    }

                    // Append the parent groups
                    if (link.groups) {
                        this._buildMenuLayer(item, link.groups, _selected, link.enabled, _target);
                    }
                }
            }

            firstGroup = firstGroup && firstElem;
        }
    };

    /**
     * Builds the context menu from the given action links
     *
     * @param {type} _links
     * @param {type} _selected
     * @param {type} _target
     * @returns {egwMenu|EgwActionImplementation._buildMenu.menu}
     */
    private _buildMenu = (_links, _selected, _target) => {
        // Build a tree containing all actions
        const tree = {"root": []};

        // Automatically add in Drag & Drop actions
		if(this.auto_paste && !window.egwIsMobile() && (!this._context?.event || this._context?.event && !this._context.event?.type.match(/touch/)))
		{
            this._addCopyPaste(_links, _selected);
        }

        for (const k in _links) {
			_links[k].actionObj.appendToTree(tree);
		}

        // We need the dummy object container in order to pass the array by
        // reference
        const groups = {
            "groups": []
        };

        if (tree.root.length > 0) {
            // Sort every action object layer by the given sort position and grouping
            this._groupLayers(tree.root[0], _links, groups);
        }

        const menu = new egwMenu();

        // Build the menu layers
        this._buildMenuLayer(menu, groups.groups, _selected, true, _target);

        return menu;
    };

    _getPageXY = function getPageXY(event) {
        // document.body.scrollTop does not work in IE
        const scrollTop = document.body.scrollTop ? document.body.scrollTop :
            document.documentElement.scrollTop;
        const scrollLeft = document.body.scrollLeft ? document.body.scrollLeft :
            document.documentElement.scrollLeft;

        return {'posx': (event.clientX + scrollLeft), 'posy': (event.clientY + scrollTop)};
    };

    /**
     * Automagically add in context menu items for copy and paste from
     * drag and drop actions, based on current clipboard and the accepted types
     *
     * @param {object[]} _links Actions for inclusion in the menu
     * @param {EgwActionObject[]} _selected Currently selected entries
     */
    private _addCopyPaste =  (_links, _selected:EgwActionObject[])=> {
        // Get a list of drag & drop actions
		const drag = _selected[0].getSelectedLinks('drag', true).links;
		const drop = _selected[0].getSelectedLinks('drop', true).links;

        // No drags & no drops means early exit (only by default added egw_cancel_drop does NOT count!)
        if ((!drag || jQuery.isEmptyObject(drag)) &&
            (!drop || jQuery.isEmptyObject(drop) ||
                Object.keys(drop).length === 1 && typeof drop.egw_cancel_drop !== 'undefined')) {
            return;
        }

        // Find existing actions so we don't get copies
        const mgr = _selected[0].manager;
        let copy_action = mgr.getActionById('egw_copy');
        let add_action = mgr.getActionById('egw_copy_add');
        let clipboard_action = mgr.getActionById('egw_os_clipboard');
        let paste_action = mgr.getActionById('egw_paste');

        // Fake UI so we can simulate the position of the drop
        const ui = {
            position: {top: 0, left: 0},
            offset: {top: 0, left: 0}
        };
		if(this._context?.event)
		{
            const event = this._context.event.originalEvent || this._context.event;
            ui.position = {top: event.pageY, left: event.pageX};
            ui.offset = {top: event.offsetY, left: event.offsetX};
        }
        // Create default copy menu action
        if (drag && !jQuery.isEmptyObject(drag)) {
            // Don't re-add if it's there
            if (copy_action == null) {
                // Create a drag action that allows linking
                copy_action = mgr.addAction('popup', 'egw_copy', window.egw.lang('Copy to clipboard'), window.egw.image('copy'), function (action, selected) {
                    // Copied, now add to clipboard
                    const clipboard = {
                        type: [],
                        selected: []
                    };

                    // When pasting we need to know the type of drag
                    for (const k in drag) {
                        if (drag[k].enabled && drag[k].actionObj.dragType.length > 0) {
                            clipboard.type = clipboard.type.concat(drag[k].actionObj.dragType);
                        }
                    }
                    clipboard.type = jQuery.uniqueSort(clipboard.type);
                    // egwAction is a circular structure and can't be stringified so just take what we want
                    // Hopefully that's enough for the action handlers
                    for (const k in selected) {
						if(selected[k].id)
						{
							clipboard.selected.push({
								id: selected[k].id,
								data: {...(window.egw.dataGetUIDdata(selected[k].id)?.data ?? {}), ...selected[k].data}
							});
						}
					}

                    // Save it in session
                    window.egw.setSessionItem('phpgwapi', 'egw_clipboard', JSON.stringify(clipboard));
                }, true);
                copy_action.group = 2.5;
            }
            if (add_action == null) {
                // Create an action to add selected to clipboard
                add_action = mgr.addAction('popup', 'egw_copy_add', window.egw.lang('Add to clipboard'), window.egw.image('copy'), function (action, selected) {
                    // Copied, now add to clipboard
                    const clipboard = JSON.parse(window.egw.getSessionItem('phpgwapi', 'egw_clipboard')) || {
                        type: [],
                        selected: []
                    };

                    // When pasting we need to know the type of drag
                    for (const k in drag) {
                        if (drag[k].enabled && drag[k].actionObj.dragType.length > 0) {
                            clipboard.type = clipboard.type.concat(drag[k].actionObj.dragType);
                        }
                    }
                    clipboard.type = [...new Set(clipboard.type)].sort();
                    // egwAction is a circular structure and can't be stringified so just take what we want
                    // Hopefully that's enough for the action handlers
                    for (const k in selected) {
						if(selected[k].id)
						{
							clipboard.selected.push({
								id: selected[k].id,
								data: {...(window.egw.dataGetUIDdata(selected[k].id)?.data ?? {}), ...selected[k].data}
							});
						}
					}

                    // Save it in session
                    window.egw.setSessionItem('phpgwapi', 'egw_clipboard', JSON.stringify(clipboard));
                }, true);
                add_action.group = 2.5;

            }
            if (clipboard_action == null) {
                // Create an action to add selected to clipboard
                clipboard_action = mgr.addAction('popup', 'egw_os_clipboard', window.egw.lang('Copy to OS clipboard'), window.egw.image('copy'), function (action) {

                    if (document.queryCommandSupported('copy')) {
                        jQuery(action.data.target).trigger('copy');
                    }
                }, true);
                clipboard_action.group = 2.5;
            }
            let os_clipboard_caption = "";
			if(this._context?.event)
			{
				os_clipboard_caption = this._context.event.target.innerText.trim().replaceAll("\n", " ");
                clipboard_action.set_caption(window.egw.lang('Copy "%1"', os_clipboard_caption.length > 20 ? os_clipboard_caption.substring(0, 20) + '...' : os_clipboard_caption));
                clipboard_action.data.target = this._context.target;
            }
            jQuery(clipboard_action.data.target).off('copy').on('copy', function (event) {
                try {
                    window.egw.copyTextToClipboard(os_clipboard_caption, clipboard_action.data.target, event).then((successful) => {
                        // Fallback
                        if (typeof successful == "undefined") {
                            // Clear message
                            window.egw.message(window.egw.lang("'%1' copied to clipboard", os_clipboard_caption.length > 20 ? os_clipboard_caption.substring(0, 20) + '...' : os_clipboard_caption));
                            window.getSelection().removeAllRanges();
                            return false;
                        } else {
                            // Show fail message
                            window.egw.message(window.egw.lang('Use Ctrl-C/Cmd-C to copy'));
                        }
                    });

                } catch (err) {
                }
            });
            if (typeof _links[copy_action.id] == 'undefined') {
                _links[copy_action.id] = {
                    "actionObj": copy_action,
                    "enabled": true,
                    "visible": true,
                    "cnt": 0
                };
            }
            if (typeof _links[add_action.id] == 'undefined') {
                _links[add_action.id] = {
                    "actionObj": add_action,
                    "enabled": true,
                    "visible": true,
                    "cnt": 0
                };
            }
            if (typeof _links[clipboard_action.id] == 'undefined') {
                _links[clipboard_action.id] = {
                    "actionObj": clipboard_action,
                    "enabled": os_clipboard_caption.length > 0,
					"visible": this._context ? os_clipboard_caption.length > 0 : true,
                    "cnt": 0
                };
            }
        }

        // Create default paste menu item
        if (drop && !jQuery.isEmptyObject(drop)) {
            // Create paste action
            // This injects the clipboard data and calls the original handler
            let paste_exec = function (action, selected) {
                // Add in clipboard as a sender
                let clipboard = JSON.parse(window.egw.getSessionItem('phpgwapi', 'egw_clipboard'));
                // Fake drop position
                drop[action.id].actionObj.ui = ui;
                // Set a flag so apps can tell the difference, if they need to
                drop[action.id].actionObj.paste = true;

                drop[action.id].actionObj.execute(clipboard.selected, selected[0]);

                drop[action.id].actionObj.paste = false;
            };

            let clipboard = JSON.parse(window.egw.getSessionItem('phpgwapi', 'egw_clipboard')) || {
                type: [],
                selected: []
            };

            // Don't re-add if action already exists
            if (paste_action == null) {
                paste_action = mgr.addAction('popup', 'egw_paste', window.egw.lang('Paste'), window.egw.image('editpaste'), paste_exec, true);
                paste_action.group = 2.5;
                paste_action.order = 9;
                if (typeof paste_action.canHaveChildren !== "boolean") {
                    paste_action.canHaveChildren.push('drop');
                }
            }

            // Set hint to something resembling current clipboard
            let hint = window.egw.lang('Clipboard') + ":\n";
            paste_action.set_hint(hint);
            // Add titles of entries
            for (let i = 0; i < clipboard.selected.length; i++) {
                let id = clipboard.selected[i].id.split('::');
				window.egw.link_title(id[0], id[1], (title) =>
				{
					if(title)
					{
						hint += title + "\n";
					}
				}, paste_action);
            }

            // Add into links, so it's included in menu
            // @ts-ignore exec uses arguments:IArguments and therefor can consume them even if ts does not know it
            if (paste_action && paste_action.enabled.exec(paste_action, clipboard.selected, _selected[0])) {
                if (typeof _links[paste_action.id] == 'undefined') {
                    _links[paste_action.id] = {
                        "actionObj": paste_action,
                        "enabled": false,
                        "visible": clipboard != null,
                        "cnt": 0
                    };
                }
                while (paste_action.children.length > 0) {
                    paste_action.children[0].remove();
                }

                // If nothing [valid] in the clipboard, don't bother with children
                if (clipboard == null || typeof clipboard.type != 'object') {
                    return;
                }

                // Add in actual actions as children
                for (let k in drop) {
					if(k == "egw_cancel_drop")
					{
						continue;
					}
					// Add some choices - need to be a copy, or they interfere with
                    // the original
                    //replace jQuery with spread operator
                    // set the Prototype of the copy set_onExecute is not available otherwise
                    let drop_clone = drop[k].actionObj.clone()//Object.assign(Object.create(Object.getPrototypeOf(drop[k].actionObj)), drop[k].actionObj) //{...drop[k].actionObj};
                    //warning This method is really slow
                    //Object.setPrototypeOf(drop_clone, EgwAction.prototype)
                    let parent = paste_action.parent === drop_clone.parent ? paste_action : (paste_action.getActionById(drop_clone.parent.id) || paste_action);
                    drop_clone.parent = parent;
                    drop_clone.onExecute = new EgwFnct(this, null, []);
                    drop_clone.children = [];
                    drop_clone.set_onExecute(paste_exec);
                    parent.children.push(drop_clone);
                    parent.allowOnMultiple = paste_action.allowOnMultiple && drop_clone.allowOnMultiple;
					_links[k] = Object.assign({}, drop[k]);
                    _links[k].actionObj = drop_clone;

                    // Drop is allowed if clipboard types intersect drop types
                    _links[k].enabled = false;
                    _links[k].visible = false;
                    for (let i = 0; i < drop_clone.acceptedTypes.length; i++) {
                        if (clipboard.type.indexOf(drop_clone.acceptedTypes[i]) != -1) {
                            _links[paste_action.id].enabled = true;
                            _links[k].enabled = true;
                            _links[k].visible = true;
                            break;
                        }
                    }
                }
            }
        }
    };
    private _context: any;
	private menu : EgwMenu;

}


/**
 * @deprecated use uppercase class
 */
export class egwPopupActionImplementation extends EgwPopupActionImplementation{}
let _popupActionImpl = null;

export function getPopupImplementation(): EgwPopupActionImplementation {
    if (!_popupActionImpl) {
        _popupActionImpl = new EgwPopupActionImplementation();
    }
    return _popupActionImpl;
}