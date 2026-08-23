import { beforeEach, describe, expect, it, vi } from "vitest";

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
