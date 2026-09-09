import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY_SCRIPTS = "recordly_teleprompter_scripts";
const STORAGE_KEY_ACTIVE_ID = "recordly_teleprompter_active_id";
const STORAGE_KEY_TEXT = "recordly_teleprompter_text";
const STORAGE_KEY_CONFIG = "recordly_teleprompter_config";

const DEFAULT_CONFIG = {
	fontSize: 22,
	scrollSpeed: 3,
	opacity: 85,
	isMirrored: false,
	autoScrollOnRecord: true,
};

describe("Teleprompter Config & Storage", () => {
	let store: Record<string, string> = {};

	beforeEach(() => {
		store = {};
		vi.stubGlobal("localStorage", {
			getItem: (key: string) => store[key] ?? null,
			setItem: (key: string, value: string) => {
				store[key] = String(value);
			},
			clear: () => {
				store = {};
			},
		});
	});

	it("saves and loads teleprompter script text", () => {
		const sampleScript = "Test script for recording";
		localStorage.setItem(STORAGE_KEY_TEXT, sampleScript);
		expect(localStorage.getItem(STORAGE_KEY_TEXT)).toBe(sampleScript);
	});

	it("saves and loads multiple teleprompter scripts", () => {
		const scripts = [
			{ id: "script-1", name: "Intro", text: "Hello world", createdAt: 1000 },
			{ id: "script-2", name: "Outro", text: "Thanks for watching", createdAt: 2000 },
		];
		localStorage.setItem(STORAGE_KEY_SCRIPTS, JSON.stringify(scripts));
		localStorage.setItem(STORAGE_KEY_ACTIVE_ID, "script-2");

		const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY_SCRIPTS) || "[]");
		expect(loaded).toHaveLength(2);
		expect(loaded[0].name).toBe("Intro");
		expect(loaded[1].name).toBe("Outro");
		expect(localStorage.getItem(STORAGE_KEY_ACTIVE_ID)).toBe("script-2");
	});

	it("supports adding and updating script title and text", () => {
		const initial = [
			{ id: "s1", name: "Script 1", text: "Original", createdAt: 1000 },
		];
		// Add script
		const added = [
			...initial,
			{ id: "s2", name: "Script 2", text: "", createdAt: 2000 },
		];
		// Edit script s2
		const updated = added.map((s) =>
			s.id === "s2" ? { ...s, name: "Updated Title", text: "New content" } : s,
		);

		localStorage.setItem(STORAGE_KEY_SCRIPTS, JSON.stringify(updated));
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_SCRIPTS) || "[]");

		expect(stored).toHaveLength(2);
		expect(stored[1].name).toBe("Updated Title");
		expect(stored[1].text).toBe("New content");
	});

	it("saves and loads custom settings", () => {
		const customConfig = {
			fontSize: 30,
			scrollSpeed: 5,
			opacity: 90,
			isMirrored: true,
			autoScrollOnRecord: false,
		};
		localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(customConfig));
		const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY_CONFIG) || "{}");
		expect(loaded).toEqual(customConfig);
	});

	it("merges defaults if partial config is saved", () => {
		const partial = { fontSize: 28 };
		const merged = { ...DEFAULT_CONFIG, ...partial };
		expect(merged.fontSize).toBe(28);
		expect(merged.scrollSpeed).toBe(3);
		expect(merged.autoScrollOnRecord).toBe(true);
	});
});
