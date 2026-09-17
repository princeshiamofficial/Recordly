/**
 * TikTok-style Dynamic Watermark Layout Generator
 *
 * Periodically and deterministically moves the watermark across unpredictable
 * safe quadrants with randomized jitter and smooth fade transitions.
 *
 * Prevents content scrapers from using fixed crop boxes or static blur masks to remove watermarks.
 */

export interface TikTokWatermarkLayout {
	x: number;
	y: number;
	alpha: number;
	slotIndex: number;
	corner: number; // 0: Top-Left, 1: Bottom-Right, 2: Top-Right, 3: Bottom-Left
}

/**
 * 32-bit integer hash to generate pseudo-random floats in [0, 1) based on slot seed
 */
function hashSlot(seed: number, salt: number): number {
	let h = (seed * 2654435761 + salt * 2246822519) >>> 0;
	h = Math.imul(h ^ (h >>> 16), 2246822519);
	h = Math.imul(h ^ (h >>> 13), 3266489917);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const TIKTOK_WATERMARK_INTERVAL_MS = 3500; // 3.5 seconds per position
export const TIKTOK_WATERMARK_FADE_MS = 250; // 250ms smooth fade transition

export function getTikTokWatermarkLayout(
	timeMs: number,
	frameWidth: number,
	frameHeight: number,
	badgeWidth: number,
	badgeHeight: number,
	scale = 1,
): TikTokWatermarkLayout {
	const safeTimeMs = Math.max(0, Number.isFinite(timeMs) ? timeMs : 0);
	const slotIndex = Math.floor(safeTimeMs / TIKTOK_WATERMARK_INTERVAL_MS);
	const timeInSlot = safeTimeMs % TIKTOK_WATERMARK_INTERVAL_MS;

	const r1 = hashSlot(slotIndex, 11);
	const r2 = hashSlot(slotIndex, 23);
	const r3 = hashSlot(slotIndex, 37);

	// Cycle through corners unpredictably using golden ratio stepping
	// 0: Top-Left, 1: Bottom-Right, 2: Top-Right, 3: Bottom-Left
	const corner = Math.floor(slotIndex * 1.61803398875 * 4 + r1 * 4) % 4;

	// Safe edge paddings
	const basePadX = Math.round(28 * scale);
	const basePadY = Math.round(24 * scale);

	// Randomized jitter within safe zone (prevents fixed crop rectangles)
	const maxJitterX = Math.round(36 * scale);
	const maxJitterY = Math.round(24 * scale);
	const jitterX = Math.round((r2 - 0.5) * 2 * maxJitterX);
	const jitterY = Math.round((r3 - 0.5) * 2 * maxJitterY);

	const minX = Math.round(16 * scale);
	const maxX = Math.max(minX, frameWidth - badgeWidth - minX);
	const minY = Math.round(16 * scale);
	const maxY = Math.max(minY, frameHeight - badgeHeight - minY);

	let x = minX;
	let y = minY;

	if (corner === 0) {
		// Top-Left
		x = Math.max(minX, Math.min(maxX, basePadX + jitterX));
		y = Math.max(minY, Math.min(maxY, basePadY + jitterY));
	} else if (corner === 1) {
		// Bottom-Right
		x = Math.max(minX, Math.min(maxX, frameWidth - badgeWidth - basePadX + jitterX));
		y = Math.max(minY, Math.min(maxY, frameHeight - badgeHeight - basePadY + jitterY));
	} else if (corner === 2) {
		// Top-Right
		x = Math.max(minX, Math.min(maxX, frameWidth - badgeWidth - basePadX + jitterX));
		y = Math.max(minY, Math.min(maxY, basePadY + jitterY));
	} else {
		// Bottom-Left
		x = Math.max(minX, Math.min(maxX, basePadX + jitterX));
		y = Math.max(minY, Math.min(maxY, frameHeight - badgeHeight - basePadY + jitterY));
	}

	// Calculate smooth fade-in and fade-out opacity at transition boundaries
	let alpha = 0.95;
	if (slotIndex === 0 && timeInSlot < TIKTOK_WATERMARK_FADE_MS) {
		// Immediate visibility at the start of video
		alpha = 0.95;
	} else if (timeInSlot < TIKTOK_WATERMARK_FADE_MS) {
		alpha = Math.max(0.08, 0.95 * (timeInSlot / TIKTOK_WATERMARK_FADE_MS));
	} else if (timeInSlot > TIKTOK_WATERMARK_INTERVAL_MS - TIKTOK_WATERMARK_FADE_MS) {
		alpha = Math.max(
			0.08,
			0.95 * ((TIKTOK_WATERMARK_INTERVAL_MS - timeInSlot) / TIKTOK_WATERMARK_FADE_MS),
		);
	}

	return { x, y, alpha, slotIndex, corner };
}
