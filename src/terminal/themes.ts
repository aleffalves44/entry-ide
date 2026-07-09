// ─── Terminal (xterm) palettes ────────────────────────────────────────
//
// Per-theme xterm.js color tables for v1.1.15's eight-theme catalog.
// Each entry mirrors the same theme's CSS tokens in `styles/themes.css`
// — when the user picks "Atelier", both the chrome AND the embedded
// terminal go warm-cocoa-with-terracotta.  Keeping the two in sync is
// what makes the terminal feel like part of the surface and not a
// stranded chunk of someone else's editor.
//
// `TerminalPool.applyXtermTheme` falls back to "frosted-dark" for any
// id that's missing here, so legacy stored ids (which `applyTheme`
// migrates on the JS side via `normalizeThemeId`) never paint a wrong
// palette during the brief window between settings load and migration
// write-back.

export const THEMES: Record<string, Record<string, string>> = {
  // ─── DARK ───────────────────────────────────────────────────────

  // Frosted Dark — Apple-y modernist, vibrant blue accent.
  // The default; matches macOS HUD vocabulary.
  "frosted-dark": {
    background: "#1c1c1e",
    foreground: "#d6d6d9",
    selectionBackground: "#0a84ff44",
    selectionForeground: "#ffffff",
    cursor: "#0a84ff",
    black: "#1c1c1e", red: "#ff453a", green: "#30d158", yellow: "#ffd60a",
    blue: "#0a84ff", magenta: "#bf5af2", cyan: "#5ac8fa", white: "#d6d6d9",
    brightBlack: "#5c5c61", brightRed: "#ff6961", brightGreen: "#5ed080",
    brightYellow: "#ffe55c", brightBlue: "#5ea7ff", brightMagenta: "#d09cf5",
    brightCyan: "#7adcfa", brightWhite: "#f5f5f7",
  },

  // Atelier — warm cocoa, terracotta accent, serif-forward writer's desk.
  atelier: {
    background: "#1a1714",
    foreground: "#c8bfb0",
    selectionBackground: "#e0785033",
    selectionForeground: "#ffffff",
    cursor: "#e07850",
    black: "#1a1714", red: "#d95555", green: "#8fbc6a", yellow: "#d4a845",
    blue: "#7a9ec2", magenta: "#b58bdb", cyan: "#6bbfb0", white: "#c8bfb0",
    brightBlack: "#6b6258", brightRed: "#e07070", brightGreen: "#a5d280",
    brightYellow: "#e0be5a", brightBlue: "#90b4d8", brightMagenta: "#cba0f0",
    brightCyan: "#80d5c6", brightWhite: "#e8e0d4",
  },

  // Observatory — deep navy + true brass; the strongest Entry identity.
  observatory: {
    background: "#0a1018",
    foreground: "#c8b896",
    selectionBackground: "#d4a86a33",
    selectionForeground: "#0a1018",
    cursor: "#d4a86a",
    black: "#0a1018", red: "#c8624c", green: "#6fa86f", yellow: "#e8b04e",
    blue: "#5a7da8", magenta: "#9d7fc4", cyan: "#5fa8a8", white: "#c8b896",
    brightBlack: "#5c5240", brightRed: "#dc7a64", brightGreen: "#85bd85",
    brightYellow: "#f4d18a", brightBlue: "#7395be", brightMagenta: "#b89ad8",
    brightCyan: "#75bcbc", brightWhite: "#e8d8b8",
  },

  // Phosphor — CRT green-on-black; the terminal-soul archetype.
  phosphor: {
    background: "#050805",
    foreground: "#80d878",
    selectionBackground: "#b0f0a833",
    selectionForeground: "#050805",
    cursor: "#b0f0a8",
    black: "#050805", red: "#ff7a6a", green: "#b0f0a8", yellow: "#f0e088",
    blue: "#5fa860", magenta: "#b08adb", cyan: "#80d8c0", white: "#80d878",
    brightBlack: "#366028", brightRed: "#ff9888", brightGreen: "#d4ffcc",
    brightYellow: "#fff5a0", brightBlue: "#7fc880", brightMagenta: "#cea8f5",
    brightCyan: "#a0e8d0", brightWhite: "#d4ffcc",
  },

  // ─── LIGHT ──────────────────────────────────────────────────────

  // Frosted Light — Apple-y light, sharp blue.  Pair to Frosted Dark.
  "frosted-light": {
    background: "#ffffff",
    foreground: "#3a3a3c",
    selectionBackground: "#0a84ff22",
    selectionForeground: "#1c1c1e",
    cursor: "#0a84ff",
    black: "#1c1c1e", red: "#d63a31", green: "#28a745", yellow: "#c89500",
    blue: "#0a84ff", magenta: "#9132d4", cyan: "#0095d6", white: "#3a3a3c",
    brightBlack: "#6c6c70", brightRed: "#e85048", brightGreen: "#3ac558",
    brightYellow: "#dfa800", brightBlue: "#3a9aff", brightMagenta: "#a854df",
    brightCyan: "#22a9e0", brightWhite: "#1c1c1e",
  },

  // Linen — warm cream paper, sepia ink, terracotta accent.  Atelier inverted.
  linen: {
    background: "#ffffff",
    foreground: "#4a3e30",
    selectionBackground: "#c45a3222",
    selectionForeground: "#2a221a",
    cursor: "#c45a32",
    black: "#2a221a", red: "#b03228", green: "#5e8a40", yellow: "#b88e1e",
    blue: "#3e6a8a", magenta: "#7a4ea8", cyan: "#3e8888", white: "#4a3e30",
    brightBlack: "#7a6b58", brightRed: "#c4453a", brightGreen: "#75a052",
    brightYellow: "#cca430", brightBlue: "#557fa3", brightMagenta: "#9266c4",
    brightCyan: "#52a0a0", brightWhite: "#2a221a",
  },

  // Newsprint — broadside; off-white + true black.  High contrast editorial.
  newsprint: {
    background: "#ffffff",
    foreground: "#2a2a2a",
    selectionBackground: "#0a0a0a18",
    selectionForeground: "#0a0a0a",
    cursor: "#0a0a0a",
    black: "#0a0a0a", red: "#a82828", green: "#2a6a2a", yellow: "#8a6818",
    blue: "#3a4878", magenta: "#4a2a8a", cyan: "#2a5878", white: "#2a2a2a",
    brightBlack: "#5a5a5a", brightRed: "#bf3636", brightGreen: "#3e8230",
    brightYellow: "#a07f24", brightBlue: "#506098", brightMagenta: "#623ca0",
    brightCyan: "#3e7090", brightWhite: "#0a0a0a",
  },

  // Atrium — soft daylight, slate accent, low contrast.  Long-session calm.
  atrium: {
    background: "#ffffff",
    foreground: "#4a5566",
    selectionBackground: "#4a6a8c22",
    selectionForeground: "#2a3548",
    cursor: "#4a6a8c",
    black: "#2a3548", red: "#b04a4a", green: "#4a8a6a", yellow: "#aa8a2a",
    blue: "#4a6a8c", magenta: "#6a4a8a", cyan: "#3e7a8a", white: "#4a5566",
    brightBlack: "#7a8090", brightRed: "#c25e5e", brightGreen: "#5fa380",
    brightYellow: "#bf9c3a", brightBlue: "#5e7fa3", brightMagenta: "#8060a0",
    brightCyan: "#5292a3", brightWhite: "#2a3548",
  },
};

export const FONT_FAMILIES: Record<string, string> = {
  default: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
  fira: "'Fira Code', 'SF Mono', Menlo, monospace",
  jetbrains: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
  cascadia: "'Cascadia Code', 'SF Mono', Menlo, monospace",
  menlo: "Menlo, 'SF Mono', monospace",
};
