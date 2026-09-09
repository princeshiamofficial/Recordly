import { app } from "electron";
import { getFfmpegBinaryPath } from "../ffmpeg/binary";
import { resolveNativeVideoEncoder } from "./native-video";

export interface DetectedEncoderInfo {
	encoderName: string;
	isHardware: boolean;
	displayName: string;
	gpuModel?: string;
	platform: NodeJS.Platform;
}

let cachedDetectedEncoderInfo: DetectedEncoderInfo | null = null;
let detectionPromise: Promise<DetectedEncoderInfo> | null = null;

export function getFriendlyEncoderDisplayName(encoderName: string): {
	displayName: string;
	isHardware: boolean;
} {
	switch (encoderName) {
		case "h264_nvenc":
			return { displayName: "NVIDIA NVENC (Hardware)", isHardware: true };
		case "h264_qsv":
			return { displayName: "Intel QuickSync (Hardware)", isHardware: true };
		case "h264_amf":
			return { displayName: "AMD AMF (Hardware)", isHardware: true };
		case "h264_videotoolbox":
			return { displayName: "Apple VideoToolbox (Hardware)", isHardware: true };
		case "h264_mf":
			return { displayName: "MediaFoundation (Hardware)", isHardware: true };
		case "libx264":
		default:
			return { displayName: "Multi-Threaded CPU (libx264)", isHardware: false };
	}
}

export async function detectSystemEncoderInfo(): Promise<DetectedEncoderInfo> {
	if (cachedDetectedEncoderInfo) {
		return cachedDetectedEncoderInfo;
	}

	if (detectionPromise) {
		return detectionPromise;
	}

	detectionPromise = (async () => {
		let gpuModel: string | undefined;

		try {
			const gpuInfo = (await app.getGPUInfo("basic")) as {
				gpuDevice?: Array<{ deviceString?: string; vendorId?: number }>;
			};
			const firstGpu = gpuInfo?.gpuDevice?.[0];
			if (firstGpu?.deviceString) {
				gpuModel = firstGpu.deviceString;
			}
		} catch {
			// GPU info lookup is non-critical
		}

		try {
			const ffmpegPath = getFfmpegBinaryPath();
			const encoderName = await resolveNativeVideoEncoder(ffmpegPath, "balanced");
			const { displayName, isHardware } = getFriendlyEncoderDisplayName(encoderName);

			const info: DetectedEncoderInfo = {
				encoderName,
				isHardware,
				displayName,
				gpuModel,
				platform: process.platform,
			};

			cachedDetectedEncoderInfo = info;
			return info;
		} catch (error) {
			console.warn(
				"[gpuDetector] Encoder detection probe failed, falling back to libx264:",
				error,
			);
			const info: DetectedEncoderInfo = {
				encoderName: "libx264",
				isHardware: false,
				displayName: "Multi-Threaded CPU (libx264)",
				gpuModel,
				platform: process.platform,
			};
			cachedDetectedEncoderInfo = info;
			return info;
		} finally {
			detectionPromise = null;
		}
	})();

	return detectionPromise;
}
