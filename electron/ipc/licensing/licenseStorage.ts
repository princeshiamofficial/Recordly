import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { safeStorage } from "electron";
import type { LicenseRecord } from "../../../src/lib/licensing/types";
import { USER_DATA_PATH } from "../../appPaths";
import { getMachineId } from "./machineId";

export const LICENSE_STORAGE_PATH = path.join(USER_DATA_PATH, "license.enc");

function getFallbackKey(): Buffer {
	const machineId = getMachineId();
	// Multi-round internal pepper mixed with machine-specific identifier
	return createHash("sha256")
		.update(`camverse-v1-storage-salt:${machineId}:app-pepper-8f4b0c2e91a7`)
		.digest();
}

function encryptPayload(data: string): Buffer {
	try {
		if (safeStorage.isEncryptionAvailable()) {
			return safeStorage.encryptString(data);
		}
	} catch {
		// Fallback to AES-256-GCM if safeStorage unavailable
	}

	const key = getFallbackKey();
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const encrypted = Buffer.concat([cipher.update(data, "utf-8"), cipher.final()]);
	const authTag = cipher.getAuthTag();

	// Format: [1 byte magic 0x01][12 bytes IV][16 bytes AuthTag][encrypted payload]
	return Buffer.concat([Buffer.from([0x01]), iv, authTag, encrypted]);
}

function decryptPayload(buffer: Buffer): string | null {
	try {
		if (safeStorage.isEncryptionAvailable()) {
			try {
				return safeStorage.decryptString(buffer);
			} catch {
				// Might have been encrypted with AES fallback
			}
		}

		if (buffer.length > 29 && buffer[0] === 0x01) {
			const key = getFallbackKey();
			const iv = buffer.subarray(1, 13);
			const authTag = buffer.subarray(13, 29);
			const encrypted = buffer.subarray(29);

			const decipher = createDecipheriv("aes-256-gcm", key, iv);
			decipher.setAuthTag(authTag);
			const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
			return decrypted.toString("utf-8");
		}
	} catch {
		return null;
	}

	return null;
}

export interface StoredLicenseResult {
	record: LicenseRecord | null;
	clockTampered: boolean;
}

/**
 * Loads and decrypts the stored license record.
 * Detects if the user's system clock was rolled back.
 */
export function loadStoredLicense(): StoredLicenseResult {
	try {
		if (!fs.existsSync(LICENSE_STORAGE_PATH)) {
			return { record: null, clockTampered: false };
		}

		const rawBuffer = fs.readFileSync(LICENSE_STORAGE_PATH);
		const decrypted = decryptPayload(rawBuffer);
		if (!decrypted) {
			return { record: null, clockTampered: false };
		}

		const record = JSON.parse(decrypted) as LicenseRecord;
		const now = Date.now();

		// If system clock is more than 1 hour earlier than last saved timestamp
		const clockTampered =
			typeof record.lastSavedTimestampMs === "number" &&
			now < record.lastSavedTimestampMs - 3600_000;

		return { record, clockTampered };
	} catch (error) {
		console.error("[LicenseStorage] Failed to read stored license:", error);
		return { record: null, clockTampered: false };
	}
}

/**
 * Encrypts and writes the license record to local disk.
 */
export function saveStoredLicense(record: LicenseRecord, overrideTimestampMs?: number): boolean {
	try {
		const updatedRecord: LicenseRecord = {
			...record,
			lastSavedTimestampMs: overrideTimestampMs ?? record.lastSavedTimestampMs ?? Date.now(),
		};

		const serialized = JSON.stringify(updatedRecord);
		const encryptedBuffer = encryptPayload(serialized);

		const dir = path.dirname(LICENSE_STORAGE_PATH);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		fs.writeFileSync(LICENSE_STORAGE_PATH, encryptedBuffer);
		return true;
	} catch (error) {
		console.error("[LicenseStorage] Failed to save license:", error);
		return false;
	}
}

/**
 * Removes the stored license record on deactivation.
 */
export function deleteStoredLicense(): boolean {
	try {
		if (fs.existsSync(LICENSE_STORAGE_PATH)) {
			fs.unlinkSync(LICENSE_STORAGE_PATH);
		}
		return true;
	} catch (error) {
		console.error("[LicenseStorage] Failed to delete stored license:", error);
		return false;
	}
}
