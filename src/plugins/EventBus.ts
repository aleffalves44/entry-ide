import type { EntryEvent, Disposable } from "./types";

export class PluginEventBus {
	private listeners = new Map<EntryEvent, Set<(...args: any[]) => void>>();

	on(event: EntryEvent, callback: (...args: any[]) => void): Disposable {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(callback);
		return {
			dispose: () => {
				this.listeners.get(event)?.delete(callback);
			},
		};
	}

	emit(event: EntryEvent, ...args: any[]): void {
		const callbacks = this.listeners.get(event);
		if (!callbacks) return;
		for (const cb of callbacks) {
			try {
				cb(...args);
			} catch (err) {
				console.error(`[PluginEventBus] Error in "${event}" listener:`, err);
			}
		}
	}

	removeAllListeners(): void {
		this.listeners.clear();
	}

	listenerCount(event: EntryEvent): number {
		return this.listeners.get(event)?.size ?? 0;
	}
}
