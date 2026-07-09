export type {
	EntryPluginAPI,
	PluginPanelProps,
	Disposable,
	PluginManifest,
	PluginContributions,
	PluginCommandContribution,
	PluginPanelContribution,
	PluginStatusBarItem,
	PluginSessionActionContribution,
	PluginSettingsSchema,
	PluginSettingDefinition,
	PluginSettingString,
	PluginSettingNumber,
	PluginSettingBoolean,
	PluginSettingSelect,
	PluginPermission,
	EntryEvent,
	ActivationEvent,
} from "./api";

/** Helper to create a typed plugin module with full type inference. */
export function definePlugin(plugin: {
	activate: (api: EntryPluginAPI) => void | Promise<void>;
	deactivate?: () => void | Promise<void>;
}): typeof plugin {
	return plugin;
}
