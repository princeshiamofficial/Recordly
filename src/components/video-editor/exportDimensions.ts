import type { ExportMp4FrameRate, ExportQuality } from "@/lib/exporter";
import { type AspectRatio, getAspectRatioValue } from "@/utils/aspectRatioUtils";

export type Mp4SupportProbeSnapshot = {
	sourceWidth: number;
	sourceHeight: number;
	targetWidth: number;
	targetHeight: number;
	aspectRatio: AspectRatio;
	frameRate: ExportMp4FrameRate;
};

export function shouldDebounceMp4SupportProbe(
	previous: Mp4SupportProbeSnapshot | null,
	current: Mp4SupportProbeSnapshot,
): boolean {
	if (
		!previous ||
		current.aspectRatio !== "native" ||
		previous.aspectRatio !== current.aspectRatio ||
		previous.frameRate !== current.frameRate ||
		previous.sourceWidth !== current.sourceWidth ||
		previous.sourceHeight !== current.sourceHeight
	) {
		return false;
	}

	return (
		previous.targetWidth !== current.targetWidth ||
		previous.targetHeight !== current.targetHeight
	);
}

function normalizeEvenDimension(value: number): number {
	return Math.max(2, Math.floor(value / 2) * 2);
}

function fitAspectRatioWithinBounds(
	maxWidth: number,
	maxHeight: number,
	aspectRatioValue: number,
): { width: number; height: number } {
	const safeMaxWidth = normalizeEvenDimension(maxWidth);
	const safeMaxHeight = normalizeEvenDimension(maxHeight);
	const safeAspectRatio =
		Number.isFinite(aspectRatioValue) && aspectRatioValue > 0 ? aspectRatioValue : 16 / 9;

	if (safeMaxWidth / safeMaxHeight > safeAspectRatio) {
		const height = safeMaxHeight;
		const width = normalizeEvenDimension(height * safeAspectRatio);
		return { width: Math.min(width, safeMaxWidth), height };
	}

	const width = safeMaxWidth;
	const height = normalizeEvenDimension(width / safeAspectRatio);
	return { width, height: Math.min(height, safeMaxHeight) };
}

export function calculateMp4SourceDimensions(
	sourceWidth: number,
	sourceHeight: number,
	aspectRatio: AspectRatio,
	cropRegion?: { width: number; height: number },
): { width: number; height: number } {
	const useCroppedBounds = aspectRatio === "native";
	const safeSourceWidth = normalizeEvenDimension(
		sourceWidth * (useCroppedBounds ? (cropRegion?.width ?? 1) : 1),
	);
	const safeSourceHeight = normalizeEvenDimension(
		sourceHeight * (useCroppedBounds ? (cropRegion?.height ?? 1) : 1),
	);
	const sourceAspectRatio = safeSourceHeight > 0 ? safeSourceWidth / safeSourceHeight : 16 / 9;
	const aspectRatioValue = getAspectRatioValue(aspectRatio, sourceAspectRatio);

	if (aspectRatio === "native") {
		return { width: safeSourceWidth, height: safeSourceHeight };
	}

	const longSide = Math.max(safeSourceWidth, safeSourceHeight);
	const shortSide = Math.min(safeSourceWidth, safeSourceHeight);
	const maxWidth = aspectRatioValue >= 1 ? longSide : shortSide;
	const maxHeight = aspectRatioValue >= 1 ? shortSide : longSide;

	return fitAspectRatioWithinBounds(maxWidth, maxHeight, aspectRatioValue);
}

export function calculateMp4ExportDimensions(
	baseWidth: number,
	baseHeight: number,
	quality: ExportQuality,
): { width: number; height: number } {
	if (quality === "source") {
		return {
			width: normalizeEvenDimension(baseWidth),
			height: normalizeEvenDimension(baseHeight),
		};
	}

	const safeBaseWidth = normalizeEvenDimension(baseWidth);
	const safeBaseHeight = normalizeEvenDimension(baseHeight);
	const isLandscape = safeBaseWidth >= safeBaseHeight;
	const aspectRatio = safeBaseHeight > 0 ? safeBaseWidth / safeBaseHeight : 16 / 9;

	let targetShortSide: number;
	switch (quality) {
		case "8k":
			targetShortSide = 4320;
			break;
		case "4k":
			targetShortSide = 2160;
			break;
		case "2k":
			targetShortSide = 1440;
			break;
		case "high":
			targetShortSide = 1080;
			break;
		case "good":
			targetShortSide = 720;
			break;
		case "medium":
			targetShortSide = 480;
			break;
		default:
			return {
				width: safeBaseWidth,
				height: safeBaseHeight,
			};
	}

	if (isLandscape) {
		const height = normalizeEvenDimension(targetShortSide);
		const width = normalizeEvenDimension(height * aspectRatio);
		return { width, height };
	} else {
		const width = normalizeEvenDimension(targetShortSide);
		const height = normalizeEvenDimension(width / aspectRatio);
		return { width, height };
	}
}
