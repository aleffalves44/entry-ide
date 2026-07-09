import { useRef, useEffect } from "react";
import type { EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { classHighlighter, highlightTree } from "@lezer/highlight";

const CHAR_W = 1.5;
const LINE_H = 3;

interface Colors {
	text: string;
	comment: string;
	string: string;
	keyword: string;
	number: string;
	fn: string;
	type: string;
	accent: string;
}

function readColors(): Colors {
	const s = getComputedStyle(document.documentElement);
	const g = (v: string, fb: string) => s.getPropertyValue(v).trim() || fb;
	return {
		text: g("--text-3", "#555"),
		comment: g("--text-3", "#555"),
		string: g("--green", "#98c379"),
		keyword: g("--magenta", "#c678dd"),
		number: g("--yellow", "#e5c07b"),
		fn: g("--blue", "#61afef"),
		type: g("--cyan", "#56b6c2"),
		accent: g("--accent", "#007acc"),
	};
}

function clsToColor(cls: string, colors: Colors): string | null {
	if (cls.includes("comment")) return colors.comment;
	if (cls.includes("string") || cls.includes("regexp")) return colors.string;
	if (cls.includes("number") || cls.includes("bool")) return colors.number;
	if (cls.includes("keyword") || cls.includes("operator") || cls.includes("modifier")) return colors.keyword;
	if (cls.includes("typeName") || cls.includes("className") || cls.includes("namespace")) return colors.type;
	if (cls.includes("definition")) return colors.fn;
	if (cls.includes("propertyName")) return colors.type;
	return null;
}

interface MinimapProps {
	view: EditorView;
	notifyRef: React.MutableRefObject<(() => void) | null>;
}

export function Minimap({ view, notifyRef }: MinimapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		if (!containerRef.current || !canvasRef.current) return;
		const container = containerRef.current;
		const canvas = canvasRef.current as HTMLCanvasElement;

		let colors = readColors();
		let rafId = 0;
		let dragging = false;

		function scheduleDraw() {
			cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(draw);
		}

		function getOffset(h: number): number {
			const mapH = view.state.doc.lines * LINE_H;
			if (mapH <= h) return 0;
			const { scrollTop, scrollHeight, clientHeight } = view.scrollDOM;
			const ratio = scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0;
			return ratio * (mapH - h);
		}

		function draw() {
			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			const dpr = window.devicePixelRatio || 1;
			const rect = container.getBoundingClientRect();
			const w = rect.width;
			const h = rect.height;
			if (w === 0 || h === 0) return;

			canvas.width = w * dpr;
			canvas.height = h * dpr;
			canvas.style.width = `${w}px`;
			canvas.style.height = `${h}px`;
			ctx.scale(dpr, dpr);
			ctx.clearRect(0, 0, w, h);

			const doc = view.state.doc;
			const totalLines = doc.lines;
			if (totalLines === 0) return;

			const mapH = totalLines * LINE_H;
			const offset = getOffset(h);

			const firstLine = Math.max(1, Math.floor(offset / LINE_H));
			const lastLine = Math.min(totalLines, Math.ceil((offset + h) / LINE_H) + 1);

			// Pass 1: Base monochrome lines
			ctx.globalAlpha = 0.3;
			ctx.fillStyle = colors.text;
			for (let ln = firstLine; ln <= lastLine; ln++) {
				const line = doc.line(ln);
				const text = line.text;
				const trimmed = text.trimEnd();
				if (!trimmed.length) continue;

				const y = (ln - 1) * LINE_H - offset;
				const nonWsMatch = trimmed.match(/\S/);
				if (!nonWsMatch || nonWsMatch.index === undefined) continue;
				const start = nonWsMatch.index;

				const x = 4 + start * CHAR_W;
				const barW = Math.min((trimmed.length - start) * CHAR_W, w - x - 2);
				if (barW > 0) {
					ctx.fillRect(x, y, barW, LINE_H - 1);
				}
			}

			// Pass 2: Syntax-colored tokens
			try {
				const fromPos = doc.line(firstLine).from;
				const toPos = doc.line(lastLine).to;
				const tree = syntaxTree(view.state);

				const batches = new Map<string, Array<{ x: number; y: number; w: number }>>();

				highlightTree(tree, classHighlighter, (from, to, cls) => {
					const color = clsToColor(cls, colors);
					if (!color || color === colors.text) return;

					const startLine = doc.lineAt(from);
					const endLine = doc.lineAt(Math.min(to, toPos));

					for (let ln = startLine.number; ln <= endLine.number; ln++) {
						if (ln < firstLine || ln > lastLine) continue;
						const line = doc.line(ln);
						const cFrom = Math.max(from, line.from) - line.from;
						const cTo = Math.min(to, line.to) - line.from;
						if (cFrom >= cTo) continue;

						const y = (ln - 1) * LINE_H - offset;
						const x = 4 + cFrom * CHAR_W;
						const tw = (cTo - cFrom) * CHAR_W;

						if (!batches.has(color)) batches.set(color, []);
						batches.get(color)!.push({ x, y, w: tw });
					}
				}, fromPos, toPos);

				ctx.globalAlpha = 0.7;
				for (const [color, rects] of batches) {
					ctx.fillStyle = color;
					for (const r of rects) {
						ctx.fillRect(r.x, r.y, r.w, LINE_H - 1);
					}
				}
			} catch {
				// Syntax tree may not be ready yet
			}

			// Pass 3: Viewport indicator
			const { scrollTop, scrollHeight, clientHeight } = view.scrollDOM;
			const vpTop = (scrollTop / scrollHeight) * mapH - offset;
			const vpH = Math.max(10, (clientHeight / scrollHeight) * mapH);

			ctx.globalAlpha = 0.1;
			ctx.fillStyle = colors.accent;
			ctx.fillRect(0, vpTop, w, vpH);

			ctx.globalAlpha = 0.5;
			ctx.fillRect(0, vpTop, 2, vpH);
		}

		function scrollToY(clientY: number) {
			const rect = canvas.getBoundingClientRect();
			const h = rect.height;
			const doc = view.state.doc;
			const totalLines = doc.lines;
			const offset = getOffset(h);
			const y = clientY - rect.top;

			const lineNum = Math.max(1, Math.min(totalLines, Math.floor((y + offset) / LINE_H) + 1));
			const line = doc.line(lineNum);
			const block = view.lineBlockAt(line.from);
			const clientH = view.scrollDOM.clientHeight;
			view.scrollDOM.scrollTop = block.top - clientH / 2;
		}

		function onMouseDown(e: MouseEvent) {
			e.preventDefault();
			dragging = true;
			scrollToY(e.clientY);
			document.addEventListener("mousemove", onMouseMove);
			document.addEventListener("mouseup", onMouseUp);
		}

		function onMouseMove(e: MouseEvent) {
			if (!dragging) return;
			e.preventDefault();
			scrollToY(e.clientY);
		}

		function onMouseUp() {
			dragging = false;
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
		}

		function onThemeChange() {
			requestAnimationFrame(() => {
				colors = readColors();
				draw();
			});
		}

		// Subscribe to editor updates via the notify ref
		notifyRef.current = scheduleDraw;

		// Listeners
		view.scrollDOM.addEventListener("scroll", scheduleDraw);
		window.addEventListener("entry:theme-changed", onThemeChange);
		canvas.addEventListener("mousedown", onMouseDown);

		const ro = new ResizeObserver(scheduleDraw);
		ro.observe(container);

		scheduleDraw();

		return () => {
			cancelAnimationFrame(rafId);
			if (notifyRef.current === scheduleDraw) notifyRef.current = null;
			ro.disconnect();
			view.scrollDOM.removeEventListener("scroll", scheduleDraw);
			window.removeEventListener("entry:theme-changed", onThemeChange);
			canvas.removeEventListener("mousedown", onMouseDown);
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
		};
	}, [view, notifyRef]);

	return (
		<div ref={containerRef} className="cm-minimap">
			<canvas ref={canvasRef} />
		</div>
	);
}
