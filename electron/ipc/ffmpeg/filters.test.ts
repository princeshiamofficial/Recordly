import { describe, expect, it } from "vitest";

import {
	appendSyncedAudioFilter,
	applyRecordedAudioStartDelay,
	buildCinematicVideoFilter,
	getAudioSyncAdjustment,
} from "./filters";

describe("getAudioSyncAdjustment", () => {
	it("does not speed up longer audio tracks that would advance speech", () => {
		expect(getAudioSyncAdjustment(120, 122.5)).toEqual({
			mode: "none",
			delayMs: 0,
			tempoRatio: 1,
			durationDeltaMs: -2500,
		});
	});

	it("still stretches slightly shorter audio tracks to match the video", () => {
		expect(getAudioSyncAdjustment(120, 117)).toEqual({
			mode: "tempo",
			delayMs: 0,
			tempoRatio: 0.975,
			durationDeltaMs: 3000,
		});
	});

	it("still delays much shorter audio tracks instead of extreme tempo correction", () => {
		expect(getAudioSyncAdjustment(120, 110)).toEqual({
			mode: "delay",
			delayMs: 10000,
			tempoRatio: 1,
			durationDeltaMs: 10000,
		});
	});

	it("pads trailing silence instead of prepending extreme delay for very short audio tracks", () => {
		expect(getAudioSyncAdjustment(600, 480)).toEqual({
			mode: "pad",
			delayMs: 0,
			tempoRatio: 1,
			durationDeltaMs: 120000,
		});
	});

	it("does not inject atempo when longer audio stays on the anchored path", () => {
		const filterParts: string[] = [];
		appendSyncedAudioFilter(filterParts, "[1:a]", "aout", getAudioSyncAdjustment(120, 122.5));

		expect(filterParts).toEqual([
			"[1:a]aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS[aout]",
		]);
	});

	it("still injects atempo for slightly shorter audio tracks", () => {
		const filterParts: string[] = [];
		appendSyncedAudioFilter(filterParts, "[1:a]", "aout", getAudioSyncAdjustment(120, 117));

		expect(filterParts).toEqual([
			"[1:a]atempo=0.975000,aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS[aout]",
		]);
	});

	it("pads the tail for very short audio tracks", () => {
		const filterParts: string[] = [];
		appendSyncedAudioFilter(filterParts, "[1:a]", "aout", getAudioSyncAdjustment(600, 480));

		expect(filterParts).toEqual([
			"[1:a]apad=pad_dur=120.000,aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS[aout]",
		]);
	});

	it("pads the remaining tail after a measured late start delay", () => {
		const filterParts: string[] = [];
		appendSyncedAudioFilter(filterParts, "[1:a]", "aout", {
			mode: "delay",
			delayMs: 18051,
			tempoRatio: 1,
			durationDeltaMs: 1631070,
		});

		expect(filterParts).toEqual([
			"[1:a]adelay=18051|18051,apad=pad_dur=1613.019,aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS[aout]",
		]);
	});

	it("does not pad when a measured late start already explains the duration gap", () => {
		const filterParts: string[] = [];
		appendSyncedAudioFilter(filterParts, "[1:a]", "aout", {
			mode: "delay",
			delayMs: 10000,
			tempoRatio: 1,
			durationDeltaMs: 10000,
		});

		expect(filterParts).toEqual([
			"[1:a]adelay=10000|10000,aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS[aout]",
		]);
	});

	it("can add a small gain boost before resampling", () => {
		const filterParts: string[] = [];
		appendSyncedAudioFilter(
			filterParts,
			"[1:a]",
			"aout",
			getAudioSyncAdjustment(120, 120),
			1.4,
		);

		expect(filterParts).toEqual([
			"[1:a]volume=1.400,aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS[aout]",
		]);
	});

	it("can prepend mic normalization filters before sync handling", () => {
		const filterParts: string[] = [];
		appendSyncedAudioFilter(filterParts, "[1:a]", "aout", getAudioSyncAdjustment(120, 120), {
			preFilters: ["adeclip=threshold=1", "loudnorm=I=-16:TP=-1.5:LRA=11"],
		});

		expect(filterParts).toEqual([
			"[1:a]adeclip=threshold=1,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS[aout]",
		]);
	});
});

describe("applyRecordedAudioStartDelay", () => {
	it("pads the tail when recorded metadata says audio started on time", () => {
		expect(applyRecordedAudioStartDelay(getAudioSyncAdjustment(120, 110), 0)).toEqual({
			mode: "pad",
			delayMs: 0,
			tempoRatio: 1,
			durationDeltaMs: 10000,
		});
	});

	it("prefers a measured start delay over a tempo-only heuristic", () => {
		expect(applyRecordedAudioStartDelay(getAudioSyncAdjustment(120, 119.8), 275)).toEqual({
			mode: "delay",
			delayMs: 275,
			tempoRatio: 1,
			durationDeltaMs: 200,
		});
	});

	it("applies a measured start delay even when durations already match", () => {
		expect(applyRecordedAudioStartDelay(getAudioSyncAdjustment(120, 120), 275)).toEqual({
			mode: "delay",
			delayMs: 275,
			tempoRatio: 1,
			durationDeltaMs: 0,
		});
	});

	it("leaves tempo correction alone when recorded metadata says there was no late start", () => {
		expect(applyRecordedAudioStartDelay(getAudioSyncAdjustment(120, 117), 0)).toEqual({
			mode: "tempo",
			delayMs: 0,
			tempoRatio: 0.975,
			durationDeltaMs: 3000,
		});
	});
});

describe("buildCinematicVideoFilter", () => {
	it("returns null for 'none' look without letterbox", () => {
		expect(buildCinematicVideoFilter("none", false)).toBeNull();
		expect(buildCinematicVideoFilter(undefined, undefined)).toBeNull();
	});

	it("builds the clean pro look filter", () => {
		const filter = buildCinematicVideoFilter("clean", false);
		expect(filter).toContain("unsharp=3:3:0.4");
		expect(filter).toContain("eq=contrast=1.04:saturation=1.08");
	});

	it("builds the teal and orange cinematic filter", () => {
		const filter = buildCinematicVideoFilter("cinematic", false);
		expect(filter).toContain("curves=r='0/0 0.5/0.56 1/1'");
		expect(filter).toContain("vignette=PI/7");
	});

	it("builds the studio vibrant filter", () => {
		const filter = buildCinematicVideoFilter("vibrant", false);
		expect(filter).toContain("eq=contrast=1.12:saturation=1.25");
	});

	it("builds the classic film filter with fine grain", () => {
		const filter = buildCinematicVideoFilter("film", false);
		expect(filter).toContain("noise=alls=3:allf=t+u");
		expect(filter).toContain("vignette=PI/6");
	});

	it("appends 21:9 letterbox drawbox filters when letterbox is enabled", () => {
		const filter = buildCinematicVideoFilter("clean", true);
		expect(filter).toContain("drawbox=x=0:y=0:w=iw:h=trunc(ih*0.125):color=black:t=fill");
		expect(filter).toContain(
			"drawbox=x=0:y=ih-trunc(ih*0.125):w=iw:h=trunc(ih*0.125):color=black:t=fill",
		);
	});

	it("supports letterbox only without any color grade look", () => {
		const filter = buildCinematicVideoFilter("none", true);
		expect(filter).toBe(
			"drawbox=x=0:y=0:w=iw:h=trunc(ih*0.125):color=black:t=fill,drawbox=x=0:y=ih-trunc(ih*0.125):w=iw:h=trunc(ih*0.125):color=black:t=fill",
		);
	});
});

