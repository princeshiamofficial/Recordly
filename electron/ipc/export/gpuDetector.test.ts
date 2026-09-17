import { describe, expect, it } from "vitest";
import { getFriendlyEncoderDisplayName } from "./gpuDetector";

describe("gpuDetector", () => {
	it("maps hardware encoder names to user-friendly display labels", () => {
		expect(getFriendlyEncoderDisplayName("h264_nvenc")).toEqual({
			displayName: "NVIDIA NVENC (Hardware)",
			isHardware: true,
		});

		expect(getFriendlyEncoderDisplayName("h264_qsv")).toEqual({
			displayName: "Intel QuickSync (Hardware)",
			isHardware: true,
		});

		expect(getFriendlyEncoderDisplayName("h264_amf")).toEqual({
			displayName: "AMD AMF (Hardware)",
			isHardware: true,
		});

		expect(getFriendlyEncoderDisplayName("h264_videotoolbox")).toEqual({
			displayName: "Apple VideoToolbox (Hardware)",
			isHardware: true,
		});

		expect(getFriendlyEncoderDisplayName("h264_mf")).toEqual({
			displayName: "MediaFoundation (Hardware)",
			isHardware: true,
		});

		expect(getFriendlyEncoderDisplayName("h264_vaapi")).toEqual({
			displayName: "Linux VA-API (Hardware)",
			isHardware: true,
		});

		expect(getFriendlyEncoderDisplayName("hevc_nvenc")).toEqual({
			displayName: "NVIDIA NVENC (Hardware)",
			isHardware: true,
		});
	});

	it("maps software libx264 encoder to CPU display label", () => {
		expect(getFriendlyEncoderDisplayName("libx264")).toEqual({
			displayName: "Multi-Threaded CPU (libx264)",
			isHardware: false,
		});

		expect(getFriendlyEncoderDisplayName("unknown_encoder")).toEqual({
			displayName: "Multi-Threaded CPU (libx264)",
			isHardware: false,
		});
	});
});
