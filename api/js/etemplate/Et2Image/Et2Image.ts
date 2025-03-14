/**
 * EGroupware eTemplate2 - Image widget
 *
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 * @package etemplate
 * @subpackage api
 * @link https://www.egroupware.org
 * @author Nathan Gray
 */

import {html, LitElement} from "lit";
import {Et2Widget} from "../Et2Widget/Et2Widget";
import {et2_IDetachedDOM} from "../et2_core_interfaces";
import {property} from "lit/decorators/property.js";
import {customElement} from "lit/decorators/custom-element.js";
import {until} from "lit/directives/until.js";
import {unsafeHTML} from "lit/directives/unsafe-html.js";

@customElement("et2-image")
export class Et2Image extends Et2Widget(LitElement) implements et2_IDetachedDOM
{

	/** Et2Image has no shadow DOM, styles in etemplate2.css
	static get styles()
	{
		return [
			...super.styles,
			css`
				:host {
					display: inline-block;
				}

				::slotted(img) {
					max-height: 100%;
					max-width: 100%;
				}

				:host([icon]) {
					height: 1.3rem;
					font-size: 1.3rem !important;
				}
			`];
	}
	 */

	/**
	 * The label of the image
	 * Actually not used as label, but we put it as title
	 */
	@property({type: String})
	label = "";

	/**
	 * Image
	 * Displayed image
	 */
	@property({type: String})
	set src(_src)
	{
		this.classList.forEach(_class =>
		{
			if(_class.startsWith('bi-'))
			{
				this.classList.remove(_class);
			}
		});

		this.__src = _src;
		let url = this.parse_href(_src) || this.parse_href(this.defaultSrc);
		if(!url)
		{
			// Hide if no valid image
			if (this._img) this._img.src = '';
			return;
		}
		const bootstrap = url.match(/\/node_modules\/bootstrap-icons\/icons\/([^.]+)\.svg/);
		if (bootstrap && !this._img)
		{
			this.classList.add('bi-' + bootstrap[1]);
			return;
		}
		// change between bootstrap and regular img
		this.requestUpdate();
	}
	get src()
	{
		return this.__src;
	}
	private __src: string;
	/**
	 * Default image
	 * Image to use if src is not found
	 */
	@property({type: String})
	defaultSrc = "";

	/**
	 * Link Target
	 * Link URL, empty if you don't wan't to display a link.
	 */
	@property({type: String})
	href = "";

	/**
	 * Link target
	 * Link target descriptor
	 */
	@property({type: String})
	extraLinkTarget = "_self";

	/**
	 * Popup
	 * widthxheight, if popup should be used, eg. 640x480
	 */
	@property({type: String})
	extraLinkPopup = "";

	/**
	 * Width of image:
	 * - either number of px (e.g. 32) or
	 * - string incl. CSS unit (e.g. "32px") or
	 * - even CSS functions like e.g. "calc(1rem + 2px)"
	 */
	@property({type: String})
	set width(_width : string)
	{
		if (this.style)
		{
			this.style.width = isNaN(_width) ? _width : _width+'px';
		}
	}
	get width()
	{
		return this.style?.width;
	}

	/**
	 * Height of image:
	 * - either number of px (e.g. 32) or
	 * - string incl. CSS unit (e.g. "32px") or
	 * - even CSS functions like e.g. "calc(1rem + 2px)"
	 */
	@property({type: String})
	set height(_height)
	{
		if (this.style)
		{
			this.style.height = isNaN(_height) ? _height : _height+'px';
		}
	}
	get height()
	{
		return this.style.height;
	}

	constructor()
	{
		super();

		this._handleClick = this._handleClick.bind(this);
	}

	connectedCallback()
	{
		super.connectedCallback();
	}

	render()
	{
		const url = this.parse_href(this.src) || this.parse_href(this.defaultSrc);
		if(!url)
		{
			// Hide if no valid image
			return html``;
		}
		// set title on et2-image for both bootstrap-image via css-class and embedded img tag
		this.title = this.statustext || this.label || "";

		const bootstrap = url.match(/\/node_modules\/bootstrap-icons\/icons\/([^.]+)\.svg/);
		if (bootstrap)
		{
			this.classList.add('bi-'+bootstrap[1]);
			return html``;
		}

        // our own svg images
		// We have svg images prefixed "bi-". These are used like bootstrap font icons.
		// We inline them to be able to control there color etc. directly via css

        //only call unsafeHtml when we are inside /egroupware/
        const ourSvg = url.startsWith(this.egw().webserverUrl + '/') //checks if source is trusted
        if (ourSvg && url.match(/\/bi-.*\.svg/))
        {
            const svg = fetch(url)
                .then(res => res.text()
                    .then(text => unsafeHTML(text)));
            return html`
                ${until(svg, html`<span>...</span>`)}
            `
        }

        // fallback case (no svg, web source)
		return html`
            <img ${this.id ? html`id="${this.id}"` : ''}
                 src="${url}"
                 alt="${this.label || this.statustext}"
				 style="${this.height ? 'max-height: 100%; width: auto' : 'max-width: 100%; height: auto'}"
                 part="image"
                 loading="lazy"
            >`;
	}

	/**
	 * Puts the rendered content / img-tag in light DOM
	 * @link https://lit.dev/docs/components/shadow-dom/#implementing-createrenderroot
	 */
	protected createRenderRoot()
	{
		return this;
	}

	protected parse_href(img_href : string) : string
	{
		img_href = img_href || '';
		// allow url's too
		if(img_href[0] == '/' || img_href.substr(0, 4) == 'http' ||
			img_href.substr(0, 5) == 'data:' ||
			img_href.substr(0, 5) == 'blob:'
		)
		{
			return img_href;
		}
		let src = this.egw() && typeof this.egw().image == "function" ? this.egw()?.image(img_href) : "";
		if(src)
		{
			return src;
		}
		return "";
	}

	_handleClick(_ev : MouseEvent) : boolean
	{
		if(this.href)
		{
			this.egw().open_link(this.href, this.extraLinkTarget, this.extraLinkPopup);
		}
		else
		{
			return super._handleClick(_ev);
		}
	}

	get _img()
	{
		return this.querySelector('img');
	}

	/**
	 * Handle changes that have to happen based on changes to properties
	 *
	 */
	updated(changedProperties)
	{
		super.updated(changedProperties);

		// if there's an href or onclick, make it look clickable
		if(changedProperties.has("href") || typeof this.onclick !== "undefined")
		{
			this.classList.toggle("et2_clickable", this.href || typeof this.onclick !== "undefined")
		}
		for(const changedPropertiesKey in changedProperties)
		{
			if(Et2Image.getPropertyOptions()[changedPropertiesKey] &&
				!(changedPropertiesKey === 'label' || changedPropertiesKey === 'statustext'))
			{
				this._img[changedPropertiesKey] = this[changedPropertiesKey];
			}
		}
	}

	transformAttributes(_attrs : any)
	{
		super.transformAttributes(_attrs);

		// Expand src with additional stuff
		// This should go away, since we're not checking for $ or @
		if(typeof _attrs["src"] != "undefined")
		{
			let manager = this.getArrayMgr("content");
			if(manager && _attrs["src"])
			{
				let src = manager.getEntry(_attrs["src"], false, true);
				if(typeof src != "undefined" && src !== null)
				{
					if(typeof src == "object")
					{
						this.src = this.egw().link('/index.php', src);
					}
					else
					{
						this.src = src;
					}
				}
			}
		}
	}

	/**
	 * Code for implementing et2_IDetachedDOM
	 *
	 * Individual widgets are detected and handled by the grid, but the interface is needed for this to happen
	 *
	 * @param {array} _attrs array to add further attributes to
	 */
	getDetachedAttributes(_attrs)
	{
		_attrs.push("src", "label", "href", "statustext");
	}

	getDetachedNodes()
	{
		return [<HTMLElement><unknown>this];
	}

	setDetachedAttributes(_nodes, _values)
	{
		for(let attr in _values)
		{
			this[attr] = _values[attr];
		}
	}
}