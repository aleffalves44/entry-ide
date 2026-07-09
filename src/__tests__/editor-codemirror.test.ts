/**
 * CodeMirror editor module tests.
 *
 * Covers:
 * 1. getLanguageSupport — returns LanguageSupport for all 14 languages, null for unsupported, caches results
 * 2. getLanguageForExtension — maps ALL extensions correctly, plaintext for unknown, leading dot, case insensitive
 * 3. exposeCodeMirror — sets window.__entryCM correctly
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Tauri APIs ─────────────────────────────────────────────────
vi.mock("@tauri-apps/api/core", () => ({
	invoke: vi.fn(),
}));

// ===================================================================
// 1. getLanguageSupport
// ===================================================================
describe("getLanguageSupport", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	const SUPPORTED_LANGUAGES = [
		"javascript",
		"typescript",
		"rust",
		"python",
		"go",
		"java",
		"cpp",
		"php",
		"sql",
		"yaml",
		"html",
		"css",
		"json",
		"markdown",
	];

	it("supports exactly 14 languages", () => {
		expect(SUPPORTED_LANGUAGES).toHaveLength(14);
	});

	for (const lang of SUPPORTED_LANGUAGES) {
		it(`returns LanguageSupport for "${lang}"`, async () => {
			const { getLanguageSupport } = await import("../editor/languageRegistry");
			const result = getLanguageSupport(lang);
			expect(result).not.toBeNull();
			// LanguageSupport instances have `language` and `extension` properties
			expect(result).toHaveProperty("language");
			expect(result).toHaveProperty("extension");
		});
	}

	const UNSUPPORTED_LANGUAGES = [
		"shell",
		"dockerfile",
		"ruby",
		"plaintext",
		"swift",
		"dart",
		"lua",
		"r",
		"elixir",
		"csharp",
		"toml",
		"xml",
	];

	for (const lang of UNSUPPORTED_LANGUAGES) {
		it(`returns null for unsupported language "${lang}"`, async () => {
			const { getLanguageSupport } = await import("../editor/languageRegistry");
			expect(getLanguageSupport(lang)).toBeNull();
		});
	}

	it("returns null for empty string", async () => {
		const { getLanguageSupport } = await import("../editor/languageRegistry");
		expect(getLanguageSupport("")).toBeNull();
	});

	it("returns null for completely unknown identifier", async () => {
		const { getLanguageSupport } = await import("../editor/languageRegistry");
		expect(getLanguageSupport("brainfuck")).toBeNull();
		expect(getLanguageSupport("cobol")).toBeNull();
	});

	it("caches results — second call returns the same instance", async () => {
		const { getLanguageSupport } = await import("../editor/languageRegistry");
		const first = getLanguageSupport("rust");
		const second = getLanguageSupport("rust");
		expect(first).not.toBeNull();
		expect(first).toBe(second); // strict reference equality
	});

	it("caches each language independently", async () => {
		const { getLanguageSupport } = await import("../editor/languageRegistry");
		const ts = getLanguageSupport("typescript");
		const js = getLanguageSupport("javascript");
		expect(ts).not.toBeNull();
		expect(js).not.toBeNull();
		expect(ts).not.toBe(js); // different instances for different languages
	});

	it("is case insensitive — 'RUST' maps to same cached instance as 'rust'", async () => {
		const { getLanguageSupport } = await import("../editor/languageRegistry");
		const lower = getLanguageSupport("rust");
		const upper = getLanguageSupport("RUST");
		const mixed = getLanguageSupport("Rust");
		expect(lower).not.toBeNull();
		expect(upper).toBe(lower);
		expect(mixed).toBe(lower);
	});
});

// ===================================================================
// 2. getLanguageForExtension
// ===================================================================
describe("getLanguageForExtension", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	// Complete extension-to-language mapping matching the source exactly
	const EXTENSION_MAPPINGS: [string, string][] = [
		// Rust
		["rs", "rust"],
		// TypeScript
		["ts", "typescript"],
		["tsx", "typescript"],
		// JavaScript
		["js", "javascript"],
		["jsx", "javascript"],
		["mjs", "javascript"],
		["cjs", "javascript"],
		// Python
		["py", "python"],
		// Go
		["go", "go"],
		// Java
		["java", "java"],
		// C / C++
		["c", "cpp"],
		["h", "cpp"],
		["cpp", "cpp"],
		["hpp", "cpp"],
		["cc", "cpp"],
		["cxx", "cpp"],
		// PHP
		["php", "php"],
		// SQL
		["sql", "sql"],
		// YAML
		["yaml", "yaml"],
		["yml", "yaml"],
		// HTML
		["html", "html"],
		["htm", "html"],
		// CSS variants
		["css", "css"],
		["scss", "css"],
		["sass", "css"],
		["less", "css"],
		// JSON
		["json", "json"],
		// Markdown
		["md", "markdown"],
		["markdown", "markdown"],
		// Kotlin (Java grammar fallback)
		["kt", "java"],
		["kts", "java"],
		// Shell (no CM package)
		["sh", "shell"],
		["bash", "shell"],
		["zsh", "shell"],
		// Dockerfile (no CM package)
		["dockerfile", "dockerfile"],
		// Other languages without bundled CM packages
		["rb", "ruby"],
		["swift", "swift"],
		["dart", "dart"],
		["lua", "lua"],
		["r", "r"],
		["ex", "elixir"],
		["exs", "elixir"],
		["cs", "csharp"],
		["toml", "toml"],
		["xml", "xml"],
		["svg", "xml"],
	];

	for (const [ext, expectedLang] of EXTENSION_MAPPINGS) {
		it(`maps "${ext}" -> "${expectedLang}"`, async () => {
			const { getLanguageForExtension } = await import("../editor/languageRegistry");
			expect(getLanguageForExtension(ext)).toBe(expectedLang);
		});
	}

	it('returns "plaintext" for unknown extensions', async () => {
		const { getLanguageForExtension } = await import("../editor/languageRegistry");
		expect(getLanguageForExtension("xyz")).toBe("plaintext");
		expect(getLanguageForExtension("unknown")).toBe("plaintext");
		expect(getLanguageForExtension("bak")).toBe("plaintext");
		expect(getLanguageForExtension("log")).toBe("plaintext");
		expect(getLanguageForExtension("tmp")).toBe("plaintext");
	});

	it('returns "plaintext" for empty string', async () => {
		const { getLanguageForExtension } = await import("../editor/languageRegistry");
		expect(getLanguageForExtension("")).toBe("plaintext");
	});

	it("handles leading dot — strips dot before lookup", async () => {
		const { getLanguageForExtension } = await import("../editor/languageRegistry");
		expect(getLanguageForExtension(".rs")).toBe("rust");
		expect(getLanguageForExtension(".ts")).toBe("typescript");
		expect(getLanguageForExtension(".py")).toBe("python");
		expect(getLanguageForExtension(".go")).toBe("go");
		expect(getLanguageForExtension(".json")).toBe("json");
		expect(getLanguageForExtension(".md")).toBe("markdown");
		expect(getLanguageForExtension(".html")).toBe("html");
		expect(getLanguageForExtension(".css")).toBe("css");
		expect(getLanguageForExtension(".cpp")).toBe("cpp");
	});

	it("is case insensitive", async () => {
		const { getLanguageForExtension } = await import("../editor/languageRegistry");
		expect(getLanguageForExtension("RS")).toBe("rust");
		expect(getLanguageForExtension("TS")).toBe("typescript");
		expect(getLanguageForExtension("Ts")).toBe("typescript");
		expect(getLanguageForExtension("PY")).toBe("python");
		expect(getLanguageForExtension("GO")).toBe("go");
		expect(getLanguageForExtension("JAVA")).toBe("java");
		expect(getLanguageForExtension("JSON")).toBe("json");
		expect(getLanguageForExtension("HTML")).toBe("html");
		expect(getLanguageForExtension("CSS")).toBe("css");
		expect(getLanguageForExtension("CPP")).toBe("cpp");
		expect(getLanguageForExtension("YAML")).toBe("yaml");
		expect(getLanguageForExtension("YML")).toBe("yaml");
		expect(getLanguageForExtension("SQL")).toBe("sql");
		expect(getLanguageForExtension("PHP")).toBe("php");
		expect(getLanguageForExtension("MD")).toBe("markdown");
	});

	it("handles leading dot combined with uppercase", async () => {
		const { getLanguageForExtension } = await import("../editor/languageRegistry");
		expect(getLanguageForExtension(".RS")).toBe("rust");
		expect(getLanguageForExtension(".TS")).toBe("typescript");
		expect(getLanguageForExtension(".Tsx")).toBe("typescript");
		expect(getLanguageForExtension(".Jsx")).toBe("javascript");
		expect(getLanguageForExtension(".Go")).toBe("go");
		expect(getLanguageForExtension(".JAVA")).toBe("java");
		expect(getLanguageForExtension(".YAML")).toBe("yaml");
	});
});

// ===================================================================
// 3. exposeCodeMirror
// ===================================================================

// In the Node test environment, `window` may not be fully defined.
// The codemirrorExports module writes to `window`, so we provide a
// minimal stub via globalThis for safe access.
const _global = globalThis as Record<string, unknown>;

describe("exposeCodeMirror", () => {
	beforeEach(() => {
		vi.resetModules();
		_global.window = _global.window ?? {};
		delete (_global.window as Record<string, unknown>).__entryCM;
	});

	it("sets window.__entryCM with state, view, language, highlight modules", async () => {
		const { exposeCodeMirror } = await import("../editor/codemirrorExports");
		exposeCodeMirror();

		const cm = (_global.window as Record<string, unknown>).__entryCM as Record<string, unknown> | undefined;
		expect(cm).toBeDefined();
		expect(cm).toHaveProperty("state");
		expect(cm).toHaveProperty("view");
		expect(cm).toHaveProperty("language");
		expect(cm).toHaveProperty("highlight");
	});

	it("all four modules are defined objects (not undefined)", async () => {
		const { exposeCodeMirror } = await import("../editor/codemirrorExports");
		exposeCodeMirror();

		const cm = (_global.window as Record<string, unknown>).__entryCM as Record<string, unknown>;
		expect(cm.state).toBeDefined();
		expect(typeof cm.state).toBe("object");
		expect(cm.view).toBeDefined();
		expect(typeof cm.view).toBe("object");
		expect(cm.language).toBeDefined();
		expect(typeof cm.language).toBe("object");
		expect(cm.highlight).toBeDefined();
		expect(typeof cm.highlight).toBe("object");
	});

	it("state module contains EditorState", async () => {
		const { exposeCodeMirror } = await import("../editor/codemirrorExports");
		exposeCodeMirror();

		const cm = (_global.window as Record<string, unknown>).__entryCM as Record<string, unknown>;
		expect(cm.state).toHaveProperty("EditorState");
	});

	it("view module contains EditorView", async () => {
		const { exposeCodeMirror } = await import("../editor/codemirrorExports");
		exposeCodeMirror();

		const cm = (_global.window as Record<string, unknown>).__entryCM as Record<string, unknown>;
		expect(cm.view).toHaveProperty("EditorView");
	});

	it("language module contains syntaxHighlighting", async () => {
		const { exposeCodeMirror } = await import("../editor/codemirrorExports");
		exposeCodeMirror();

		const cm = (_global.window as Record<string, unknown>).__entryCM as Record<string, unknown>;
		expect(cm.language).toHaveProperty("syntaxHighlighting");
	});

	it("highlight module contains tags", async () => {
		const { exposeCodeMirror } = await import("../editor/codemirrorExports");
		exposeCodeMirror();

		const cm = (_global.window as Record<string, unknown>).__entryCM as Record<string, unknown>;
		expect(cm.highlight).toHaveProperty("tags");
	});

	it("window.__entryCM is undefined before exposeCodeMirror is called", () => {
		const cm = (_global.window as Record<string, unknown>).__entryCM;
		expect(cm).toBeUndefined();
	});

	it("calling exposeCodeMirror twice overwrites without error", async () => {
		const { exposeCodeMirror } = await import("../editor/codemirrorExports");

		exposeCodeMirror();
		const first = (_global.window as Record<string, unknown>).__entryCM as Record<string, unknown>;

		exposeCodeMirror();
		const second = (_global.window as Record<string, unknown>).__entryCM as Record<string, unknown>;

		expect(first).toBeDefined();
		expect(second).toBeDefined();
		// Module references stay the same since they come from the same imports
		expect(second.state).toBe(first.state);
		expect(second.view).toBe(first.view);
	});
});
