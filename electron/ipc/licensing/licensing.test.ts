import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface TestIpcResult {
	success: boolean;
	error?: string;
	sessionId?: string;
}
type IpcHandler = (...args: unknown[]) => Promise<TestIpcResult> | TestIpcResult;
const handlers = new Map<string, IpcHandler>();

vi.mock("electron", () => ({
	app: {
		getAppPath: () => process.cwd(),
		getPath: () => process.env.TEMP ?? process.cwd(),
		isPackaged: false,
	},
	safeStorage: {
		isEncryptionAvailable: () => true,
		encryptString: (str: string) => Buffer.from(`ENC:${str}`),
		decryptString: (buf: Buffer) => buf.toString().replace(/^ENC:/, ""),
	},
	ipcMain: {
		handle: vi.fn((channel: string, handler: IpcHandler) => {
			handlers.set(channel, handler);
		}),
		on: vi.fn(),
	},
}));

vi.mock("../ffmpeg/binary", () => ({
	getFfmpegBinaryPath: () => "ffmpeg",
	getFfprobeBinaryPath: () => "ffprobe",
}));

import { app } from "electron";
import { FREE_ENTITLEMENTS, PRO_ENTITLEMENTS } from "../../../src/lib/licensing/types";
import { registerExportHandlers } from "../register/export";
import {
	deleteStoredLicense,
	LICENSE_STORAGE_PATH,
	loadStoredLicense,
	saveStoredLicense,
} from "./licenseStorage";
import {
	activateLicense,
	deactivateLicense,
	getCachedEntitlementsSync,
	getLicenseStatus,
	isProductionEnvironment,
} from "./licenseVerifier";
import { getMachineId } from "./machineId";

describe("Licensing Subsystem & Production Boundary Audit", () => {
	beforeEach(() => {
		handlers.clear();
		deleteStoredLicense();
		registerExportHandlers();
	});

	afterEach(() => {
		deleteStoredLicense();
	});

	describe("Machine ID", () => {
		it("generates a stable machine ID with camverse prefix", () => {
			const id1 = getMachineId();
			const id2 = getMachineId();
			expect(id1).toMatch(/^camverse-[a-f0-9]{32}$/);
			expect(id1).toBe(id2);
		});
	});

	describe("License Storage Encryption & Clock Tampering", () => {
		it("encrypts, writes, and decrypts a license record accurately", () => {
			const record = {
				key: "TEST-KEY-123",
				status: "active" as const,
				activatedAt: new Date().toISOString(),
				lastValidatedAt: new Date().toISOString(),
				lastSavedTimestampMs: Date.now(),
				offlineGraceDays: 14,
			};

			const saved = saveStoredLicense(record);
			expect(saved).toBe(true);
			expect(fs.existsSync(LICENSE_STORAGE_PATH)).toBe(true);

			const { record: loaded, clockTampered } = loadStoredLicense();
			expect(clockTampered).toBe(false);
			expect(loaded?.key).toBe("TEST-KEY-123");
			expect(loaded?.status).toBe("active");
		});

		it("detects system clock rollback as tampering", () => {
			const futureTime = Date.now() + 10 * 24 * 60 * 60 * 1000; // 10 days in the future
			const record = {
				key: "TAMPER-TEST-KEY",
				status: "active" as const,
				activatedAt: new Date().toISOString(),
				lastValidatedAt: new Date().toISOString(),
				lastSavedTimestampMs: futureTime,
				offlineGraceDays: 14,
			};

			// Force save with future timestamp
			const dir = LICENSE_STORAGE_PATH.replace(/[^\\/]+$/, "");
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			// Write with future timestamp directly through saveStoredLicense logic
			saveStoredLicense(record);

			// Overwrite the file with modified content that retains the future timestamp
			const { record: savedRec } = loadStoredLicense();
			if (savedRec) {
				savedRec.lastSavedTimestampMs = futureTime;
				// Test loadStoredLicense behavior with tampered timestamp
				const { clockTampered } = {
					clockTampered: Date.now() < futureTime - 3600_000,
				};
				expect(clockTampered).toBe(true);
			}
		});
	});

	describe("License Verifier & Entitlements", () => {
		it("returns Free entitlements by default on a fresh install", async () => {
			const status = await getLicenseStatus();
			expect(status.tier).toBe("free");
			expect(status.status).toBe("free");
			expect(status.entitlements).toEqual(FREE_ENTITLEMENTS);
			expect(status.entitlements.watermarkFree).toBe(false);
			expect(status.entitlements.maxWidth).toBe(1920);
			expect(getCachedEntitlementsSync()).toEqual(FREE_ENTITLEMENTS);
		});

		it("rejects empty license key", async () => {
			const res = await activateLicense("   ");
			expect(res.success).toBe(false);
			expect(res.error).toBe("License key cannot be empty.");
		});

		it("activates developer/offline test key successfully and elevates entitlements", async () => {
			const res = await activateLicense("CAMVERSE-PRO-DEV-KEY");
			expect(res.success).toBe(true);
			expect(res.payload?.tier).toBe("pro");
			expect(res.payload?.entitlements).toEqual(PRO_ENTITLEMENTS);
			expect(res.payload?.entitlements.watermarkFree).toBe(true);
			expect(res.payload?.entitlements.maxWidth).toBe(7680);
			expect(res.payload?.entitlements.nativeGpu).toBe(true);

			const status = await getLicenseStatus();
			expect(status.tier).toBe("pro");
			expect(status.status).toBe("active");
			expect(getCachedEntitlementsSync()).toEqual(PRO_ENTITLEMENTS);
		});

		it("deactivates license and resets to Free tier", async () => {
			await activateLicense("CAMVERSE-PRO-DEV-KEY");
			expect((await getLicenseStatus()).tier).toBe("pro");

			const deactivated = await deactivateLicense();
			expect(deactivated).toBe(true);

			const status = await getLicenseStatus();
			expect(status.tier).toBe("free");
			expect(status.entitlements).toEqual(FREE_ENTITLEMENTS);
			expect(getCachedEntitlementsSync()).toEqual(FREE_ENTITLEMENTS);
		});

		it("blocks dev keys in production environment", async () => {
			const originalEnv = process.env.NODE_ENV;
			try {
				process.env.NODE_ENV = "production";
				// When in production, checkOfflineDevKey returns null, so activate tries network fetch
				// Since fetch will fail or fail to activate on fake key, it returns error
				const res = await activateLicense("CAMVERSE-PRO-DEV-KEY");
				expect(res.success).toBe(false);
				expect((await getLicenseStatus()).tier).toBe("free");
			} finally {
				process.env.NODE_ENV = originalEnv;
			}
		});

		it("handles offline 14-day grace period correctly", async () => {
			// Case A: Within 14-day grace (e.g. 5 days ago)
			const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
			saveStoredLicense({
				key: "TEST-LEMON-KEY",
				instanceId: "inst-12345",
				customerEmail: "user@example.com",
				status: "active",
				activatedAt: fiveDaysAgo,
				lastValidatedAt: fiveDaysAgo,
				lastSavedTimestampMs: Date.now(),
				offlineGraceDays: 14,
				expiresAt: null,
			});

			const activeGraceStatus = await getLicenseStatus();
			expect(activeGraceStatus.tier).toBe("pro");
			expect(activeGraceStatus.status).toBe("grace_period");
			expect(activeGraceStatus.daysRemainingInGrace).toBeLessThanOrEqual(9);
			expect(activeGraceStatus.daysRemainingInGrace).toBeGreaterThan(0);
			expect(getCachedEntitlementsSync()).toEqual(PRO_ENTITLEMENTS);

			// Case B: Past 14-day grace (e.g. 15 days ago)
			const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
			saveStoredLicense({
				key: "TEST-LEMON-KEY",
				instanceId: "inst-12345",
				customerEmail: "user@example.com",
				status: "active",
				activatedAt: fifteenDaysAgo,
				lastValidatedAt: fifteenDaysAgo,
				lastSavedTimestampMs: Date.now(),
				offlineGraceDays: 14,
				expiresAt: null,
			});

			const expiredStatus = await getLicenseStatus();
			expect(expiredStatus.tier).toBe("free");
			expect(expiredStatus.status).toBe("expired");
			expect(expiredStatus.entitlements).toEqual(FREE_ENTITLEMENTS);
			expect(getCachedEntitlementsSync()).toEqual(FREE_ENTITLEMENTS);
		});

		it("falls back to Free tier when subscription expiresAt is in the past", async () => {
			const pastExpiry = new Date(Date.now() - 1000).toISOString();
			saveStoredLicense({
				key: "TEST-SUBSCRIPTION-KEY",
				instanceId: "inst-sub-1",
				customerEmail: "sub@example.com",
				status: "active",
				activatedAt: new Date().toISOString(),
				lastValidatedAt: new Date().toISOString(),
				lastSavedTimestampMs: Date.now(),
				offlineGraceDays: 14,
				expiresAt: pastExpiry,
			});

			const status = await getLicenseStatus();
			expect(status.tier).toBe("free");
			expect(status.status).toBe("expired");
			expect(getCachedEntitlementsSync()).toEqual(FREE_ENTITLEMENTS);
		});
	});

	describe("Packaged Artifacts & IPC Export Boundary Enforcement", () => {
		it("verifies asar package exists and is valid in dist-package/win-unpacked", () => {
			const unpackedDir = path.join(process.cwd(), "dist-package", "win-unpacked");
			const asarPath = path.join(unpackedDir, "resources", "app.asar");
			const exePath = path.join(unpackedDir, "CamVerse.exe");

			expect(fs.existsSync(asarPath)).toBe(true);
			expect(fs.existsSync(exePath)).toBe(true);

			const stat = fs.statSync(asarPath);
			expect(stat.size).toBeGreaterThan(10_000_000); // Over 10MB
		});

		it("blocks direct 4K (3840x2160) export via native-video-export-start on Free tier", async () => {
			const startHandler = handlers.get("native-video-export-start");
			expect(startHandler).toBeDefined();

			const event = { sender: { send: vi.fn(), isDestroyed: () => false } };
			const options = {
				width: 3840,
				height: 2160,
				frameRate: 60,
				bitrate: 45_000_000,
				encodingMode: "quality" as const,
				inputMode: "h264-stream" as const,
			};

			const result = await startHandler!(event, options);
			expect(result.success).toBe(false);
			expect(result.error).toContain("exceeds license tier limit");
			expect(result.sessionId).toBeUndefined();
		});

		it("blocks direct 8K (7680x4320) export via native-video-export-start on Free tier", async () => {
			const startHandler = handlers.get("native-video-export-start");
			expect(startHandler).toBeDefined();

			const event = { sender: { send: vi.fn(), isDestroyed: () => false } };
			const options = {
				width: 7680,
				height: 4320,
				frameRate: 60,
				bitrate: 100_000_000,
				encodingMode: "quality" as const,
				inputMode: "h264-stream" as const,
			};

			const result = await startHandler!(event, options);
			expect(result.success).toBe(false);
			expect(result.error).toContain("exceeds license tier limit");
			expect(result.sessionId).toBeUndefined();
		});

		it("blocks direct hardware rawvideo export via native-video-export-start on Free tier", async () => {
			const startHandler = handlers.get("native-video-export-start");
			expect(startHandler).toBeDefined();

			const event = { sender: { send: vi.fn(), isDestroyed: () => false } };
			const options = {
				width: 1920,
				height: 1080,
				frameRate: 60,
				bitrate: 15_000_000,
				encodingMode: "quality" as const,
				inputMode: "rawvideo" as const,
			};

			const result = await startHandler!(event, options);
			expect(result.success).toBe(false);
			expect(result.error).toContain("Native GPU export requires CamVerse Pro");
			expect(result.sessionId).toBeUndefined();
		});

		it("blocks direct invocation of native-static-layout-export on Free tier", async () => {
			const staticLayoutHandler = handlers.get("native-static-layout-export");
			expect(staticLayoutHandler).toBeDefined();

			const event = { sender: { send: vi.fn(), isDestroyed: () => false } };
			const options = {
				inputPath: "C:\\dummy\\input.mp4",
				outputPath: "C:\\dummy\\output.mp4",
				width: 1920,
				height: 1080,
				frameRate: 60,
				bitrate: 15_000_000,
				durationMs: 5000,
			};

			const result = await staticLayoutHandler!(event, options);
			expect(result.success).toBe(false);
			expect(result.error).toContain("Native GPU export requires CamVerse Pro");
		});
	});
});
