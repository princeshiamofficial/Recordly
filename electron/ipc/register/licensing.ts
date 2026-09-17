import { ipcMain } from "electron";
import {
	activateLicense,
	deactivateLicense,
	getLicenseStatus,
} from "../licensing/licenseVerifier";

export function registerLicensingHandlers() {
	ipcMain.handle("license:get-status", async () => {
		try {
			return await getLicenseStatus();
		} catch (error) {
			console.error("[IPC] Failed to get license status:", error);
			return {
				tier: "free",
				status: "free",
				entitlements: {
					tier: "free",
					watermarkFree: false,
					maxWidth: 1920,
					maxHeight: 1080,
					maxFps: 60,
					nativeGpu: false,
					advancedCodecs: false,
					aiSubtitles: false,
					customPresets: false,
				},
				isOffline: false,
			};
		}
	});

	ipcMain.handle("license:activate", async (_event, key: unknown) => {
		try {
			if (typeof key !== "string" || !key.trim()) {
				return { success: false, error: "License key must be a valid string." };
			}
			return await activateLicense(key);
		} catch (error) {
			console.error("[IPC] Failed to activate license:", error);
			const msg = error instanceof Error ? error.message : "Activation failed";
			return { success: false, error: msg };
		}
	});

	ipcMain.handle("license:deactivate", async () => {
		try {
			const success = await deactivateLicense();
			return { success };
		} catch (error) {
			console.error("[IPC] Failed to deactivate license:", error);
			return { success: false };
		}
	});
}
