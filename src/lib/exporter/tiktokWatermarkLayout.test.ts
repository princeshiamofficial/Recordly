import { describe, expect, it } from "vitest";
import {
	getTikTokWatermarkLayout,
	TIKTOK_WATERMARK_FADE_MS,
	TIKTOK_WATERMARK_INTERVAL_MS,
} from "./tiktokWatermarkLayout";

describe("tiktokWatermarkLayout", () => {
	const FRAME_W = 1920;
	const FRAME_H = 1080;
	const BADGE_W = 200;
	const BADGE_H = 46;

	it("keeps watermark within safe frame boundaries at all times", () => {
		for (let timeMs = 0; timeMs <= 60_000; timeMs += 500) {
			const layout = getTikTokWatermarkLayout(timeMs, FRAME_W, FRAME_H, BADGE_W, BADGE_H, 1);
			expect(layout.x).toBeGreaterThanOrEqual(16);
			expect(layout.x + BADGE_W).toBeLessThanOrEqual(FRAME_W);
			expect(layout.y).toBeGreaterThanOrEqual(16);
			expect(layout.y + BADGE_H).toBeLessThanOrEqual(FRAME_H);
			expect(layout.alpha).toBeGreaterThanOrEqual(0.05);
			expect(layout.alpha).toBeLessThanOrEqual(0.96);
		}
	});

	it("stays steady and identical on consecutive frames within the same slot", () => {
		const frame1 = getTikTokWatermarkLayout(1000, FRAME_W, FRAME_H, BADGE_W, BADGE_H, 1);
		const frame2 = getTikTokWatermarkLayout(1033, FRAME_W, FRAME_H, BADGE_W, BADGE_H, 1);
		const frame3 = getTikTokWatermarkLayout(1066, FRAME_W, FRAME_H, BADGE_W, BADGE_H, 1);

		expect(frame1.x).toBe(frame2.x);
		expect(frame1.y).toBe(frame2.y);
		expect(frame2.x).toBe(frame3.x);
		expect(frame2.y).toBe(frame3.y);
	});

	it("moves to different positions across intervals (TikTok style bouncing)", () => {
		const slot0 = getTikTokWatermarkLayout(1000, FRAME_W, FRAME_H, BADGE_W, BADGE_H, 1);
		const slot1 = getTikTokWatermarkLayout(
			1000 + TIKTOK_WATERMARK_INTERVAL_MS,
			FRAME_W,
			FRAME_H,
			BADGE_W,
			BADGE_H,
			1,
		);
		const slot2 = getTikTokWatermarkLayout(
			1000 + TIKTOK_WATERMARK_INTERVAL_MS * 2,
			FRAME_W,
			FRAME_H,
			BADGE_W,
			BADGE_H,
			1,
		);

		const isSame01 = slot0.x === slot1.x && slot0.y === slot1.y;
		const isSame12 = slot1.x === slot2.x && slot1.y === slot2.y;

		// Consecutive intervals must change position
		expect(isSame01).toBe(false);
		expect(isSame12).toBe(false);
	});

	it("smoothly transitions opacity at the interval boundaries", () => {
		// Middle of slot: solid alpha
		const mid = getTikTokWatermarkLayout(1500, FRAME_W, FRAME_H, BADGE_W, BADGE_H, 1);
		expect(mid.alpha).toBeCloseTo(0.95, 2);

		// Near end of slot: fading out
		const nearEnd = getTikTokWatermarkLayout(
			TIKTOK_WATERMARK_INTERVAL_MS - 50,
			FRAME_W,
			FRAME_H,
			BADGE_W,
			BADGE_H,
			1,
		);
		expect(nearEnd.alpha).toBeLessThan(0.95);
	});
});
