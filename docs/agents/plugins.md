# docs/agents/plugins.md — Plugin System

Domain guide for the plugin runtime. Read [AGENTS.md](../../AGENTS.md) first. Full design spec: `docs/plugin-system-design.md`.

## Overview

Entry IDE supports user-installable plugins. Each plugin is a directory under `<app-data>/plugins/` containing an `entry-plugin.json` manifest. The frontend runtime loads and sandboxes them; the Rust backend manages installation and file discovery.

## Directory Layout

```
src/plugins/
  types.ts              # Plugin manifest type, API surface types
  constants.ts          # Shared constants (e.g. manifest filename)
  EventBus.ts           # Typed cross-plugin event bus
  PluginAPI.ts          # API surface exposed to plugin code (15 KB)
  PluginRuntime.ts      # Loads plugins; lifecycle management (11 KB)
  PluginLoader.ts       # Fetches and validates plugin manifests (5.9 KB)
  PluginPanelHost.tsx   # React host for plugins that render a panel
  usePluginRuntime.ts   # Hook: access the active runtime from components
  pluginInstaller.ts    # Thin wrapper around the Tauri install command
  semver.ts             # Semver comparison utilities
  index.ts              # Public re-exports
  builtin/              # Bundled built-in plugins (subdirectory per plugin)
  __tests__/            # Plugin-specific test files
```

```
src-tauri/src/
  plugins.rs            # Tauri commands: list_installed_plugins, install_plugin, uninstall_plugin
```

## Plugin Manifest (`entry-plugin.json`)

Key fields:
- `id` — unique plugin identifier (reverse-domain style, e.g. `com.example.my-plugin`)
- `name`, `version`, `description`
- `main` — entry point JS/TS file within the plugin directory
- `contributes` — what the plugin adds (panels, commands, etc.)

The `InstalledPlugin` Rust struct carries `id`, `dir_name`, and the raw `manifest_json` string. Parsing is done on the frontend.

## Plugin API (`PluginAPI.ts`)

The surface exposed to plugin code. Plugins access it through the sandbox — they do not import from `src/` directly.

Key capabilities available to plugins (see `PluginAPI.ts` for the full list):
- Register panel components
- Subscribe to session events via `EventBus`
- Invoke a restricted set of Tauri commands
- Read app settings (read-only)

Do not expand the plugin API without reviewing the security implications. Plugins run in the frontend process — they cannot break the Rust backend, but they can affect UI state.

## `PluginRuntime.ts`

Manages plugin lifecycle:
1. `loadAll()` — calls `list_installed_plugins` Tauri command, parses manifests, initialises each plugin's sandbox
2. `enable(id)` / `disable(id)` — runtime toggle without full reload
3. `reload(id)` — hot-reload a single plugin (dev workflow)

The runtime is a singleton created once in `App.tsx` and accessed via `usePluginRuntime()`.

## `EventBus.ts`

Typed publish/subscribe. Plugins emit and subscribe to named events. The bus is shared across all plugins and the host application. Event names are namespaced by plugin id to prevent collisions.

## Rust Backend (`plugins.rs`)

Three Tauri commands:

| Command | What it does |
|---|---|
| `list_installed_plugins` | Scans `<app-data>/plugins/`; returns manifests |
| `install_plugin` | Extracts a plugin archive into the plugins directory |
| `uninstall_plugin` | Removes the plugin directory |

The Rust side does not execute plugin code. All plugin execution happens in the frontend.

## Adding a Built-in Plugin

1. Create a subdirectory under `src/plugins/builtin/`.
2. Add an `entry-plugin.json` manifest.
3. Register the built-in in `PluginLoader.ts` so it is always available without filesystem discovery.
4. Add tests under `src/plugins/__tests__/`.

## Constraints

- Plugins cannot import from `src/` directly. They receive capabilities through `PluginAPI` only.
- Do not add Tauri commands to `plugins.rs` that execute arbitrary code or grant filesystem write access outside the plugin's own directory.
- Built-in plugins are part of the core bundle; they must not add significant startup cost.
