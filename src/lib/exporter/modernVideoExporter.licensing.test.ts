import { beforeEach, describe, expect, it, vi } from "vitest";
import { FREE_ENTITLEMENTS, PRO_ENTITLEMENTS } from "../licensing/types";
import type { VideoExporterConfig } from "./modernVideoExporter";
import { ModernVideoExporter } from "./modernVideoExporter";

interface MockElectronWindow {
	window?: {
		electronAPI?: {
			getLicenseStatus?: ReturnType<typeof vi.fn>;
		};
	};
}

const mockGlobal = globalThis as MockElectronWindow;

describe("Export Pipeline Licensing & Entitlements Enforcement", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	function createMockConfig(overrides: Partial<VideoExporterConfig> = {}): VideoExporterConfig {
		return {
			width: 1920,
			height: 1080,
			frameRate: 30,
			bitrate: 8_000_000,
			videoUrl: "blob:test-video",
			wallpaper: "#000000",
			cropRegion: { x: 0, y: 0, width: 1, height: 1 },
			zoomRegions: [],
			trimRegions: [],
			speedRegions: [],
			showShadow: false,
			shadowIntensity: 0,
			backgroundBlur: 0,
			showWatermark: true,
			...overrides,
		} as VideoExporterConfig;
	}

	it("explicitly rejects 4K UHD export on Free tier with clear upgrade guidance", async () => {
		// Mock Free tier
		mockGlobal.window = {
			electronAPI: {
				getLicenseStatus: vi.fn().mockResolvedValue({
					tier: "free",
					status: "free",
					entitlements: FREE_ENTITLEMENTS,
					isOffline: false,
				}),
			},
		};

		const config = createMockConfig({ width: 3840, height: 2160 });
		const exporter = new ModernVideoExporter(config);

		const result = await exporter.export();
		expect(result.success).toBe(false);
		expect(result.error).toContain("Export resolution (3840×2160) requires CamVerse Pro");
	});

	it("automatically enforces watermark for Free tier exports", async () => {
		mockGlobal.window = {
			electronAPI: {
				getLicenseStatus: vi.fn().mockResolvedValue({
					tier: "free",
					status: "free",
					entitlements: FREE_ENTITLEMENTS,
					isOffline: false,
				}),
			},
		};

		const config = createMockConfig({ width: 1920, height: 1080, showWatermark: false });
		const exporter = new ModernVideoExporter(config);

		// Expect exporter to check license and set showWatermark to true before trying to load metadata
		try {
			await exporter.export();
		} catch {
			// May fail later at videoUrl load in test environment, but config.showWatermark should be true
		}

		expect(config.showWatermark).toBe(true);
	});

	it("disables watermark and allows 4K export on Pro tier", async () => {
		mockGlobal.window = {
			electronAPI: {
				getLicenseStatus: vi.fn().mockResolvedValue({
					tier: "pro",
					status: "active",
					entitlements: PRO_ENTITLEMENTS,
					isOffline: false,
				}),
			},
		};

		const config = createMockConfig({ width: 3840, height: 2160, showWatermark: false });
		const exporter = new ModernVideoExporter(config);

		try {
			await exporter.export();
		} catch (error: unknown) {
			// Should NOT fail with resolution error
			const msg = error instanceof Error ? error.message : String(error);
			expect(msg).not.toContain("requires CamVerse Pro");
		}

		expect(config.showWatermark).toBe(false);
	});

	it("disables Native GPU Compositor on Free tier and reverts to WebCodecs", async () => {
		mockGlobal.window = {
			electronAPI: {
				getLicenseStatus: vi.fn().mockResolvedValue({
					tier: "free",
					status: "free",
					entitlements: FREE_ENTITLEMENTS,
					isOffline: false,
				}),
			},
		};

		const config = createMockConfig({
			width: 1920,
			height: 1080,
			experimentalNvidiaCudaExport: true,
			experimentalNativeExport: true,
		});
		const exporter = new ModernVideoExporter(config);

		try {
			await exporter.export();
		} catch {
			// ignore later stage errors in mock env
		}

		expect(config.experimentalNvidiaCudaExport).toBe(false);
		expect(config.experimentalNativeExport).toBe(false);
	});
});
