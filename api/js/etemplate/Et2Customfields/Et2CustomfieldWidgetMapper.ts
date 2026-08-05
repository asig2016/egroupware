import type {Et2CustomfieldDefinition} from "./Et2CustomfieldsController";

export type Et2CustomfieldRenderContext = "field" | "list" | "filters" | "row";

export interface Et2CustomfieldWidgetMappingOptions
{
	context : Et2CustomfieldRenderContext;
	readonly? : boolean;
	apps? : Record<string, any>;
	prefix? : string;
}

export interface Et2CustomfieldWidgetMapping
{
	tagName : string;
	attrs : Record<string, any>;
}

export function mapCustomfieldToWidget(
	fieldName : string,
	field : Et2CustomfieldDefinition & Record<string, any>,
	value : any,
	options : Et2CustomfieldWidgetMappingOptions
) : Et2CustomfieldWidgetMapping | null
{
	const context = options.context || "list";
	const prefix = options.prefix || "#";
	const apps = options.apps || defaultLinkApps();
	const attrs : Record<string, any> = {
		id: prefix + fieldName,
		label: field?.label || fieldName,
		noLang: true,
		readonly: options.readonly === true,
		statustext: field?.help || "",
		value: value ?? ""
	};
	if(typeof field?.needed !== "undefined")
	{
		attrs.needed = field.needed;
	}
	if(attrs.readonly === true)
	{
		delete attrs.needed;
	}

	if(context === "filters")
	{
		if(!isAllowedCustomfieldFilter(field, apps))
		{
			return null;
		}
		attrs.needed = false;
		delete attrs.rows;
		const filterType = String(field?.type || "text");
		if(filterType.startsWith("select") || typeof apps[filterType] !== "undefined")
		{
			attrs.emptyLabel = attrs.emptyLabel || "all";
			attrs.multiple = true;
		}
		else if(filterType === "checkbox")
		{
			// a checkbox on its own can't express "don't filter":
			// use a select instead - "!1" negates server-side
			attrs.emptyLabel = attrs.emptyLabel || "all";
			attrs.select_options = [
				{value: "1", label: egwLang("Yes")},
				{value: "!1", label: egwLang("No")}
			];
			return finalizeMapping("select", attrs);
		}
		else if(filterType === "radio")
		{
			attrs.emptyLabel = attrs.emptyLabel || "all";
		}
		else if(filterType === "date" || filterType === "date-time")
		{
			// a single date can only match exactly - filter with a from/to range
			return finalizeMapping("date-range", attrs);
		}
		// other types (text, int, float, ...) filter with their edit widget
	}

	const sourceType = String(field?.type || "text").replace(/_/g, "-");
	const isAppBacked = typeof apps[sourceType] !== "undefined";
	let widgetType = sourceType;

	if(isAppBacked)
	{
		if(sourceType === "filemanager")
		{
			return mapFilemanagerField(fieldName, field, attrs);
		}
		const app = typeof field.only_app === "undefined"
			? sourceType
			: (field.onlyApp ?? field.only_app);
		if(context !== "filters")
		{
			// filters render no separate label column, the widget label is all there is
			delete attrs.label;
		}
		attrs.value = normalizeLinkValue(app, value);
		if(attrs.readonly && context !== "filters")
		{
			widgetType = "link";
			attrs.app = app;
		}
		else
		{
			widgetType = "link-entry";
			attrs.onlyApp = app;
			attrs.searchOptions = {filter: field.values || {}};
		}
		return finalizeMapping(widgetType, attrs);
	}

	switch(sourceType)
	{
		case "text":
			delete attrs.label;
			widgetType = Number(field.rows) > 1 && context !== "filters" ? "textarea" : "textbox";
			if(widgetType === "textarea")
			{
				attrs.rows = field.rows;
			}
			if(field.len)
			{
				attrs.size = field.len;
				if(Number(field.rows) === 1)
				{
					attrs.maxlength = field.len;
				}
			}
			break;

		case "passwd":
			delete attrs.label;
			widgetType = "textbox";
			attrs.type = "password";
			Object.assign(attrs, {
				viewable: field.values?.viewable ?? true,
				plaintext: field.values?.plaintext ?? false,
				suggest: field.values?.suggest ?? 16,
				autocomplete: field.values?.autocomplete ?? "new-password"
			});
			break;

		case "serial":
			delete attrs.label;
			widgetType = "textbox";
			attrs.readonly = true;
			break;

		case "int":
			delete attrs.label;
			widgetType = "number";
			attrs.precision = 0;
			break;

		case "float":
			delete attrs.label;
			widgetType = "number";
			if(field.len)
			{
				attrs.size = field.len;
			}
			break;

		case "select":
			delete attrs.label;
			applySelectSettings(field, attrs);
			break;

		case "select-account":
			attrs.empty_label = "Select";
			if(field.account_type)
			{
				attrs.account_type = field.account_type;
			}
			delete attrs.label;
			applySelectSettings(field, attrs);
			break;

		case "date":
			attrs.data_format = field.values?.format || "Y-m-d";
			break;

		case "date-time":
			attrs.data_format = field.values?.format || "Y-m-d H:i:s";
			break;

		case "htmlarea":
			attrs.config = {
				...(field.config || {}),
				toolbarStartupExpanded: false
			};
			if(field.len)
			{
				attrs.config.width = field.len + "px";
			}
			attrs.config.height = ((Number(field.rows) > 0 ? Number(field.rows) : 5) * 16) + "px";
			break;

		case "radio":
			delete attrs.label;
			widgetType = "select";
			attrs.select_options = normalizeCustomfieldOptions(withoutEmptyOption(field.values || {}));
			if(field.values && field.values[""])
			{
				attrs.label = field.values[""];
			}
			break;

		case "checkbox":
			if(attrs.readonly && context !== "field")
			{
				attrs.ro_true = field.label;
			}
			if(Object.prototype.hasOwnProperty.call(field, "ro_true"))
			{
				attrs.ro_true = field.ro_true;
			}
			if(Object.prototype.hasOwnProperty.call(field, "ro_false"))
			{
				attrs.ro_false = field.ro_false;
			}
			break;

		case "button":
			if(context !== "field" || attrs.readonly)
			{
				return null;
			}
			attrs.label = field.label;
			if(field.values && typeof field.values === "object")
			{
				const first = Object.keys(field.values)[0];
				if(first)
				{
					attrs.label = first;
					attrs.onclick = field.values[first];
				}
			}
			break;

		case "filemanager":
			return context === "filters" ? null : mapFilemanagerField(fieldName, field, attrs);

		case "url":
			if(context !== "field")
			{
				attrs.label = field.label;
			}
			break;

		default:
			applyValueSettingsToAttrs(field, attrs, widgetType);
			break;
	}

	if(sourceType !== "select" && sourceType !== "select-account" && sourceType !== "radio")
	{
		applyValueSettingsToAttrs(field, attrs, widgetType);
	}
	if(context === "filters")
	{
		// filters render no separate label column, the widget label is all there is
		attrs.label = field?.label || fieldName;
		// a rows limit is an edit-dialog setting, legacy filters always dropped it
		delete attrs.rows;
	}
	return finalizeMapping(widgetType, attrs);
}

export function isAllowedCustomfieldFilter(
	field : Et2CustomfieldDefinition & Record<string, any>,
	apps : Record<string, any> = {}
) : boolean
{
	const type = String(field?.type || "");
	return ["filemanager", "button", "passwd", "htmlarea", "serial", "label"].indexOf(type) === -1;
}

export function normalizeCustomfieldOptions(source : any) : Array<{value : string; label : string}>
{
	if(!source || typeof source !== "object")
	{
		return [];
	}
	if(Array.isArray(source))
	{
		return source.map((option) =>
		{
			if(option && typeof option === "object")
			{
				return {
					value: String(option.value ?? ""),
					label: String(option.label ?? option.value ?? "")
				};
			}
			return {value: String(option), label: String(option)};
		});
	}
	return Object.keys(source)
		.filter((key) => key !== "@")
		.map((key) => ({
			value: key,
			label: String(source[key])
		}));
}

function egwLang(phrase : string) : string
{
	try
	{
		const egw = (globalThis as any).egw;
		const egwInstance = typeof egw === "function" ? egw() : egw;
		return egwInstance?.lang?.(phrase) || phrase;
	}
	catch(e)
	{
		return phrase;
	}
}

function defaultLinkApps() : Record<string, any>
{
	try
	{
		const egw = (globalThis as any).egw;
		const egwInstance = typeof egw === "function" ? egw() : egw;
		return egwInstance?.link_app_list?.() || {};
	}
	catch(e)
	{
		return {};
	}
}

function normalizeLinkValue(app : string, value : any)
{
	if(!value)
	{
		return "";
	}
	if(typeof value === "object")
	{
		return {
			...value,
			app: value.app || app,
			id: value.id ?? value.entryId ?? value.value ?? ""
		};
	}
	return {
		app,
		id: String(value)
	};
}

export function applyCustomfieldWidgetMapping(element : Element | undefined, mapping : Et2CustomfieldWidgetMapping)
{
	if(!element)
	{
		return;
	}
	const attrs = {...(mapping.attrs || {})};
	if(typeof (element as any).transformAttributes === "function")
	{
		(element as any).transformAttributes(attrs);
	}
	for(const [name, value] of Object.entries(attrs))
	{
		if(typeof value === "undefined")
		{
			continue;
		}
		(element as any)[name] = value;
		if(typeof value === "boolean")
		{
			element.toggleAttribute(name, value);
		}
		else if(name === "id" || name === "title")
		{
			element.setAttribute(name, String(value));
		}
	}
}

function applySelectSettings(field : Record<string, any>, attrs : Record<string, any>)
{
	// rows "0"/null must not become a rows attribute: Et2Select limits its
	// tag area to calc(var(--rows) * ...), so rows="0" collapses it to 0px
	if(Number(field.rows) > 0)
	{
		attrs.rows = field.rows;
	}
	if(Number(attrs.rows) > 1)
	{
		attrs.multiple = true;
	}
	const values = field.values || field.select_options || field.options || {};
	if(values && values["@"])
	{
		attrs.searchUrl = values["@"];
	}
	const selectOptions = normalizeCustomfieldOptions(values);
	if(selectOptions.length)
	{
		attrs.select_options = selectOptions;
	}
}

function applyValueSettingsToAttrs(field : Record<string, any>, attrs : Record<string, any>, widgetType : string)
{
	if(!field.values || typeof field.values !== "object" || Array.isArray(field.values))
	{
		return;
	}
	if(["select", "radio", "radiogroup", "checkbox", "button"].includes(String(field.type || widgetType)))
	{
		return;
	}
	for(const [name, value] of Object.entries(field.values))
	{
		if(name === "format" || name === "@")
		{
			continue;
		}
		attrs[name] = value;
	}
}

function mapFilemanagerField(
	_fieldName : string,
	field : Record<string, any>,
	attrs : Record<string, any>
) : Et2CustomfieldWidgetMapping
{
	delete attrs.label;
	const values = field.values && typeof field.values === "object" ? {...field.values} : {};
	if(typeof values.mime !== "undefined" && typeof values.accept === "undefined")
	{
		values.accept = values.mime;
	}
	if(typeof values.max_file_size !== "undefined" && typeof values.maxFileSize === "undefined")
	{
		values.maxFileSize = values.max_file_size;
	}
	for(const name of ["accept", "maxFileSize"])
	{
		if(typeof values[name] !== "undefined")
		{
			attrs[name] = values[name];
		}
	}
	return finalizeMapping("vfs-upload", attrs);
}

function withoutEmptyOption(values : Record<string, any>) : Record<string, any>
{
	const next = {...values};
	delete next[""];
	return next;
}

function finalizeMapping(widgetType : string, attrs : Record<string, any>) : Et2CustomfieldWidgetMapping
{
	if(typeof attrs.needed !== "undefined")
	{
		attrs.required = attrs.needed;
		delete attrs.needed;
	}
	if(typeof attrs.size !== "undefined" && !["small", "medium", "large"].includes(String(attrs.size)))
	{
		const size = Number(attrs.size);
		if(size > 0)
		{
			attrs.width = size + "em";
		}
		delete attrs.size;
	}
	const tagName = resolveWidgetTag(widgetType, attrs.readonly === true);
	return {tagName, attrs};
}

function resolveWidgetTag(widgetType : string, readonly : boolean) : string
{
	const baseTag = widgetType.startsWith("et2-") ? widgetType : "et2-" + widgetType;
	if(readonly && customElements.get(baseTag + "_ro"))
	{
		return baseTag + "_ro";
	}
	if(customElements.get(baseTag))
	{
		return baseTag;
	}
	return "et2-description";
}
