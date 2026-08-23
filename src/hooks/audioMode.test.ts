import { describe, expect, it } from "vitest";
import type { AudioRecordingMode } from "./useScreenRecorder";

function getAudioRecordingMode(
	systemAudioEnabled: boolean,
	microphoneEnabled: boolean,
): AudioRecordingMode {
	if (systemAudioEnabled && microphoneEnabled) return "both";
	if (systemAudioEnabled && !microphoneEnabled) return "internal";
	if (!systemAudioEnabled && microphoneEnabled) return "external";
	return "none";
}

function resolveAudioModeToggle(mode: AudioRecordingMode): {
	systemAudioEnabled: boolean;
	microphoneEnabled: boolean;
} {
	switch (mode) {
		case "internal":
			return { systemAudioEnabled: true, microphoneEnabled: false };
		case "external":
			return { systemAudioEnabled: false, microphoneEnabled: true };
		case "both":
			return { systemAudioEnabled: true, microphoneEnabled: true };
		case "none":
			return { systemAudioEnabled: false, microphoneEnabled: false };
	}
}

describe("Audio Recording Mode Helper", () => {
	it("derives internal audio mode when only system audio is enabled", () => {
		expect(getAudioRecordingMode(true, false)).toBe("internal");
	});

	it("derives external audio mode when only microphone is enabled", () => {
		expect(getAudioRecordingMode(false, true)).toBe("external");
	});

	it("derives both audio mode when both system audio and microphone are enabled", () => {
		expect(getAudioRecordingMode(true, true)).toBe("both");
	});

	it("derives none audio mode when neither audio source is enabled", () => {
		expect(getAudioRecordingMode(false, false)).toBe("none");
	});

	it("resolves toggle state for internal mode", () => {
		expect(resolveAudioModeToggle("internal")).toEqual({
			systemAudioEnabled: true,
			microphoneEnabled: false,
		});
	});

	it("resolves toggle state for external mode", () => {
		expect(resolveAudioModeToggle("external")).toEqual({
			systemAudioEnabled: false,
			microphoneEnabled: true,
		});
	});

	it("resolves toggle state for both mode", () => {
		expect(resolveAudioModeToggle("both")).toEqual({
			systemAudioEnabled: true,
			microphoneEnabled: true,
		});
	});
});
