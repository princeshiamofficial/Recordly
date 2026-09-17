import os from "node:os";
import { app } from "electron";
import type {
	ActivationResult,
	CamVerseEntitlements,
	LicenseRecord,
	LicenseStatusPayload,
} from "../../../src/lib/licensing/types";
import { FREE_ENTITLEMENTS, PRO_ENTITLEMENTS } from "../../../src/lib/licensing/types";
import { deleteStoredLicense, loadStoredLicense, saveStoredLicense } from "./licenseStorage";
import { getMachineId } from "./machineId";

// Supabase Direct Licensing Endpoint Configuration
const DEFAULT_SUPABASE_URL = "https://rqremmfisvggplqxxist.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxcmVtbWZpc3ZnZ3BscXh4aXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMDE2NjIsImV4cCI6MjEwNDc3NzY2Mn0.pbhSKOZbbRlqXXco1eaCczXLT9X1Q_Dd5xkNp7tpAkg";

const SUPABASE_URL =
	process.env.CAMVERSE_SUPABASE_URL ||
	process.env.VITE_SUPABASE_URL ||
	DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY =
	process.env.CAMVERSE_SUPABASE_ANON_KEY ||
	process.env.VITE_SUPABASE_ANON_KEY ||
	DEFAULT_SUPABASE_ANON_KEY;

const DEFAULT_OFFLINE_GRACE_DAYS = 14;
const DEV_TEST_KEYS = new Set(["CAMVERSE-PRO-DEV-KEY", "CAMVERSE-PRO-TEST-VALID"]);

export function isProductionEnvironment(): boolean {
	try {
		if (typeof app !== "undefined" && app?.isPackaged) {
			return true;
		}
	} catch {
		// Electron app not initialized (e.g. CLI or test environment)
	}
	return process.env.NODE_ENV === "production";
}

interface SupabaseActivationResponse {
	activated?: boolean;
	instance_id?: string;
	customer_email?: string;
	customer_name?: string;
	plan_tier?: "pro" | "team" | "lifetime";
	activation_limit?: number;
	activation_usage?: number;
	expires_at?: string | null;
	error?: string;
}

interface SupabaseValidationResponse {
	valid?: boolean;
	plan_tier?: "pro" | "team" | "lifetime";
	activation_limit?: number;
	activation_usage?: number;
	expires_at?: string | null;
	error?: string;
}

function calculateGraceRemainingDays(lastValidatedAtIso: string, graceDays: number): number {
	try {
		const lastValidatedMs = new Date(lastValidatedAtIso).getTime();
		const nowMs = Date.now();
		const elapsedMs = Math.max(0, nowMs - lastValidatedMs);
		const totalGraceMs = graceDays * 24 * 60 * 60 * 1000;
		if (elapsedMs >= totalGraceMs) {
			return 0;
		}
		return Math.ceil((totalGraceMs - elapsedMs) / (24 * 60 * 60 * 1000));
	} catch {
		return 0;
	}
}

/**
 * Validates whether the key is an internal dev/offline grant key.
 * STRICT: Disabled completely in production builds.
 */
function checkOfflineDevKey(key: string): { valid: boolean; email?: string } | null {
	if (isProductionEnvironment()) {
		return null;
	}
	const trimmed = key.trim();
	if (DEV_TEST_KEYS.has(trimmed)) {
		return { valid: true, email: "developer@camverse.app" };
	}
	return null;
}

function getSupabaseHeaders(): Record<string, string> {
	return {
		Accept: "application/json",
		"Content-Type": "application/json",
		apikey: SUPABASE_ANON_KEY,
		Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
	};
}

/**
 * Activates a license key against Supabase Direct Licensing RPC (or offline token).
 */
export async function activateLicense(rawKey: string): Promise<ActivationResult> {
	const key = rawKey.trim();
	if (!key) {
		return { success: false, error: "License key cannot be empty." };
	}

	const devGrant = checkOfflineDevKey(key);
	if (devGrant) {
		const nowIso = new Date().toISOString();
		const record: LicenseRecord = {
			key,
			instanceId: `dev-instance-${getMachineId()}`,
			customerEmail: devGrant.email,
			customerName: "CamVerse Pro User",
			productName: "CamVerse Pro",
			status: "active",
			activatedAt: nowIso,
			expiresAt: null, // Lifetime
			lastValidatedAt: nowIso,
			lastSavedTimestampMs: Date.now(),
			offlineGraceDays: 365,
		};
		saveStoredLicense(record);
		return {
			success: true,
			payload: {
				tier: "pro",
				status: "active",
				entitlements: PRO_ENTITLEMENTS,
				customerEmail: devGrant.email,
				expiresAt: null,
				isOffline: true,
			},
		};
	}

	try {
		const machineId = getMachineId();
		const deviceName = `${os.hostname()} (${process.platform})`;
		let appVersion = "1.3.5";
		try {
			if (typeof app !== "undefined" && typeof app.getVersion === "function") {
				appVersion = app.getVersion();
			}
		} catch {
			// fallback
		}

		const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/activate_license`, {
			method: "POST",
			headers: getSupabaseHeaders(),
			body: JSON.stringify({
				p_license_key: key,
				p_machine_id: machineId,
				p_device_name: deviceName,
				p_platform: process.platform,
				p_app_version: appVersion,
			}),
		});

		const data = (await response.json()) as SupabaseActivationResponse;

		if (!response.ok || !data.activated) {
			const errorMessage =
				data.error ||
				"Invalid license key or activation limit reached. Please verify your key.";
			return { success: false, error: errorMessage };
		}

		const nowIso = new Date().toISOString();
		const record: LicenseRecord = {
			key,
			instanceId: data.instance_id,
			customerEmail: data.customer_email,
			customerName: data.customer_name,
			productName: "CamVerse Pro",
			status: "active",
			activatedAt: nowIso,
			expiresAt: data.expires_at ?? null,
			lastValidatedAt: nowIso,
			lastSavedTimestampMs: Date.now(),
			offlineGraceDays: DEFAULT_OFFLINE_GRACE_DAYS,
		};

		saveStoredLicense(record);

		return {
			success: true,
			payload: {
				tier: "pro",
				status: "active",
				entitlements: PRO_ENTITLEMENTS,
				customerEmail: record.customerEmail,
				expiresAt: record.expiresAt,
				isOffline: false,
			},
		};
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Network error";
		return {
			success: false,
			error: `Could not reach license server (${msg}). Check your internet connection.`,
		};
	}
}

/**
 * Deactivates current machine from Supabase and wipes local license.
 */
export async function deactivateLicense(): Promise<boolean> {
	const { record } = loadStoredLicense();
	if (!record) {
		return true;
	}

	if (!checkOfflineDevKey(record.key)) {
		try {
			await fetch(`${SUPABASE_URL}/rest/v1/rpc/deactivate_license`, {
				method: "POST",
				headers: getSupabaseHeaders(),
				body: JSON.stringify({
					p_license_key: record.key,
					p_machine_id: getMachineId(),
				}),
			});
		} catch {
			// Best-effort remote deactivation
		}
	}

	deleteStoredLicense();
	return true;
}

/**
 * Gets current license status & entitlements.
 * Runs in Electron Main process (native boundary enforcement).
 * Evaluates offline grace period and clock manipulation.
 */
export async function getLicenseStatus(): Promise<LicenseStatusPayload> {
	const { record, clockTampered } = loadStoredLicense();

	if (!record) {
		return {
			tier: "free",
			status: "free",
			entitlements: FREE_ENTITLEMENTS,
			isOffline: false,
		};
	}

	if (clockTampered) {
		console.warn(
			"[LicenseVerifier] System clock tampering detected. Falling back to Free tier.",
		);
		return {
			tier: "free",
			status: "revoked",
			entitlements: FREE_ENTITLEMENTS,
			customerEmail: record.customerEmail,
			isOffline: false,
		};
	}

	// Check dev/test key without network
	if (checkOfflineDevKey(record.key)) {
		return {
			tier: "pro",
			status: "active",
			entitlements: PRO_ENTITLEMENTS,
			customerEmail: record.customerEmail,
			expiresAt: record.expiresAt,
			isOffline: true,
		};
	}

	// Check if subscription has expired by date
	if (record.expiresAt) {
		const expiresMs = new Date(record.expiresAt).getTime();
		if (Date.now() > expiresMs) {
			return {
				tier: "free",
				status: "expired",
				entitlements: FREE_ENTITLEMENTS,
				customerEmail: record.customerEmail,
				expiresAt: record.expiresAt,
				isOffline: false,
			};
		}
	}

	// Try background validate with Supabase if internet available
	if (record.instanceId) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 4000);

			const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/validate_license`, {
				method: "POST",
				signal: controller.signal,
				headers: getSupabaseHeaders(),
				body: JSON.stringify({
					p_license_key: record.key,
					p_machine_id: getMachineId(),
				}),
			});
			clearTimeout(timeoutId);

			if (response.ok) {
				const data = (await response.json()) as SupabaseValidationResponse;
				if (data.valid) {
					// Refresh last validated timestamp
					const updatedRecord: LicenseRecord = {
						...record,
						lastValidatedAt: new Date().toISOString(),
						lastSavedTimestampMs: Date.now(),
					};
					saveStoredLicense(updatedRecord);

					return {
						tier: "pro",
						status: "active",
						entitlements: PRO_ENTITLEMENTS,
						customerEmail: record.customerEmail,
						expiresAt: data.expires_at ?? record.expiresAt,
						isOffline: false,
					};
				} else {
					// License revoked or disabled remotely
					return {
						tier: "free",
						status: "revoked",
						entitlements: FREE_ENTITLEMENTS,
						customerEmail: record.customerEmail,
						isOffline: false,
					};
				}
			}
		} catch {
			// Network request failed — fall through to offline grace check
		}
	}

	// Offline Grace Period calculation
	const graceDays = record.offlineGraceDays || DEFAULT_OFFLINE_GRACE_DAYS;
	const daysRemaining = calculateGraceRemainingDays(record.lastValidatedAt, graceDays);

	if (daysRemaining > 0) {
		return {
			tier: "pro",
			status: "grace_period",
			entitlements: PRO_ENTITLEMENTS,
			customerEmail: record.customerEmail,
			expiresAt: record.expiresAt,
			daysRemainingInGrace: daysRemaining,
			isOffline: true,
		};
	}

	// Grace period expired without reconnecting
	return {
		tier: "free",
		status: "expired",
		entitlements: FREE_ENTITLEMENTS,
		customerEmail: record.customerEmail,
		daysRemainingInGrace: 0,
		isOffline: true,
	};
}

/**
 * Synchronous fast check for Electron main/native boundary enforcement.
 * Ensures the native compositor doesn't block on network calls during export.
 */
export function getCachedEntitlementsSync(): CamVerseEntitlements {
	const { record, clockTampered } = loadStoredLicense();
	if (!record || clockTampered) {
		return FREE_ENTITLEMENTS;
	}

	if (checkOfflineDevKey(record.key)) {
		return PRO_ENTITLEMENTS;
	}

	if (record.expiresAt && Date.now() > new Date(record.expiresAt).getTime()) {
		return FREE_ENTITLEMENTS;
	}

	const graceDays = record.offlineGraceDays || DEFAULT_OFFLINE_GRACE_DAYS;
	const daysRemaining = calculateGraceRemainingDays(record.lastValidatedAt, graceDays);
	if (daysRemaining <= 0) {
		return FREE_ENTITLEMENTS;
	}

	return PRO_ENTITLEMENTS;
}
