export type CamVerseTier = "free" | "pro";

export type LicenseStatus = "free" | "active" | "grace_period" | "expired" | "revoked";

export interface CamVerseEntitlements {
	tier: CamVerseTier;
	watermarkFree: boolean;
	maxWidth: number;
	maxHeight: number;
	maxFps: number;
	nativeGpu: boolean;
	advancedCodecs: boolean;
	aiSubtitles: boolean;
	customPresets: boolean;
	maxRecordingSeconds: number;
}

export const FREE_ENTITLEMENTS: Readonly<CamVerseEntitlements> = Object.freeze({
	tier: "free",
	watermarkFree: false,
	maxWidth: 1920,
	maxHeight: 1080,
	maxFps: 60,
	nativeGpu: false,
	advancedCodecs: false,
	aiSubtitles: false,
	customPresets: false,
	maxRecordingSeconds: 300, // 5 minutes max per recording
});

export const PRO_ENTITLEMENTS: Readonly<CamVerseEntitlements> = Object.freeze({
	tier: "pro",
	watermarkFree: true,
	maxWidth: 7680,
	maxHeight: 4320,
	maxFps: 60,
	nativeGpu: true,
	advancedCodecs: true,
	aiSubtitles: true,
	customPresets: true,
	maxRecordingSeconds: Infinity, // Unlimited recording duration
});

export interface LicenseRecord {
	key: string;
	instanceId?: string;
	customerEmail?: string;
	customerName?: string;
	productName?: string;
	status: LicenseStatus;
	activatedAt: string; // ISO string
	expiresAt?: string | null; // ISO string (null for lifetime licenses)
	lastValidatedAt: string; // ISO string
	lastSavedTimestampMs: number; // Monotonic validation timestamp to guard against clock rollback
	offlineGraceDays: number;
}

export interface LicenseStatusPayload {
	tier: CamVerseTier;
	status: LicenseStatus;
	entitlements: CamVerseEntitlements;
	customerEmail?: string;
	expiresAt?: string | null;
	daysRemainingInGrace?: number;
	isOffline: boolean;
}

export interface ActivationResult {
	success: boolean;
	error?: string;
	payload?: LicenseStatusPayload;
}
