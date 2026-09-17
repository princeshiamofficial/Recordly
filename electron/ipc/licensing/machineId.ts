import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";

let cachedMachineId: string | null = null;

function getWindowsMachineGuid(): string | null {
	try {
		const output = execSync(
			'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
			{ encoding: "utf-8", timeout: 2000, stdio: ["ignore", "pipe", "ignore"] },
		);
		const match = output.match(/MachineGuid\s+REG_SZ\s+([a-zA-Z0-9_-]+)/i);
		return match ? match[1].trim() : null;
	} catch {
		return null;
	}
}

function getMacPlatformUuid(): string | null {
	try {
		const output = execSync("ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID", {
			encoding: "utf-8",
			timeout: 2000,
			stdio: ["ignore", "pipe", "ignore"],
		});
		const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/i);
		return match ? match[1].trim() : null;
	} catch {
		return null;
	}
}

function getLinuxMachineId(): string | null {
	try {
		if (fs.existsSync("/etc/machine-id")) {
			return fs.readFileSync("/etc/machine-id", "utf-8").trim();
		}
		if (fs.existsSync("/var/lib/dbus/machine-id")) {
			return fs.readFileSync("/var/lib/dbus/machine-id", "utf-8").trim();
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Returns a stable, privacy-preserving machine identifier.
 * Does NOT depend on volatile network adapters (IP/MAC/Wi-Fi/VPN).
 */
export function getMachineId(): string {
	if (cachedMachineId) {
		return cachedMachineId;
	}

	let rawHardwareId: string | null = null;
	if (process.platform === "win32") {
		rawHardwareId = getWindowsMachineGuid();
	} else if (process.platform === "darwin") {
		rawHardwareId = getMacPlatformUuid();
	} else if (process.platform === "linux") {
		rawLinuxId: rawHardwareId = getLinuxMachineId();
	}

	const fallbackSeed = `${os.hostname()}:${os.platform()}:${os.arch()}:${os.cpus()[0]?.model ?? "cpu"}`;
	const baseString = rawHardwareId ? `hw:${rawHardwareId}` : `fallback:${fallbackSeed}`;

	const hash = createHash("sha256")
		.update("camverse-salt-v1:")
		.update(baseString)
		.digest("hex")
		.slice(0, 32);

	cachedMachineId = `camverse-${hash}`;
	return cachedMachineId;
}
