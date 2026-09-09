const RGBA_BYTES_PER_PIXEL = 4;

let nativeFrameCaptureMode: "video-frame-rgba" | "canvas-readback" | null = null;
let nativeFrameCaptureFallbackWarned = false;
let fallbackCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
let fallbackContext: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

function getRgbaLayout(width: number): PlaneLayout[] {
	return [{ offset: 0, stride: width * RGBA_BYTES_PER_PIXEL }];
}

function getRgbaByteSize(width: number, height: number): number {
	return width * height * RGBA_BYTES_PER_PIXEL;
}

function getFallbackReadbackContext(
	width: number,
	height: number,
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
	if (!fallbackCanvas || fallbackCanvas.width !== width || fallbackCanvas.height !== height) {
		if (typeof OffscreenCanvas !== "undefined") {
			fallbackCanvas = new OffscreenCanvas(width, height);
			fallbackContext = fallbackCanvas.getContext("2d", {
				willReadFrequently: true,
			});
		} else if (typeof document !== "undefined") {
			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			fallbackCanvas = canvas;
			fallbackContext = canvas.getContext("2d", {
				willReadFrequently: true,
			});
		} else {
			throw new Error("No canvas readback path is available for native export");
		}
	}

	if (!fallbackContext) {
		throw new Error("Failed to initialize native export frame readback context");
	}

	return fallbackContext;
}

const BUFFER_POOL_MAX_CAPACITY = 48;
const frameBufferPool = new Map<number, Uint8Array[]>();
let reusableScratchRow: Uint8Array | null = null;

export function acquireNativeFrameBuffer(byteLength: number): Uint8Array {
	const pool = frameBufferPool.get(byteLength);
	if (pool && pool.length > 0) {
		return pool.pop()!;
	}
	return new Uint8Array(byteLength);
}

export function releaseNativeFrameBuffer(buffer: Uint8Array): void {
	const byteLength = buffer.byteLength;
	let pool = frameBufferPool.get(byteLength);
	if (!pool) {
		pool = [];
		frameBufferPool.set(byteLength, pool);
	}
	if (pool.length < BUFFER_POOL_MAX_CAPACITY) {
		pool.push(buffer);
	}
}

export function clearNativeFrameBufferPool(): void {
	frameBufferPool.clear();
	reusableScratchRow = null;
}

function getScratchRow(rowByteLength: number): Uint8Array {
	if (!reusableScratchRow || reusableScratchRow.byteLength < rowByteLength) {
		reusableScratchRow = new Uint8Array(rowByteLength);
	}
	return reusableScratchRow.subarray(0, rowByteLength);
}

function flipRgbaRowsInPlace(buffer: Uint8Array, width: number, height: number): void {
	const rowByteLength = width * RGBA_BYTES_PER_PIXEL;
	const scratchRow = getScratchRow(rowByteLength);
	const halfRows = Math.floor(height / 2);

	for (let rowIndex = 0; rowIndex < halfRows; rowIndex += 1) {
		const topOffset = rowIndex * rowByteLength;
		const bottomOffset = (height - rowIndex - 1) * rowByteLength;

		scratchRow.set(buffer.subarray(topOffset, topOffset + rowByteLength));
		buffer.copyWithin(topOffset, bottomOffset, bottomOffset + rowByteLength);
		buffer.set(scratchRow, bottomOffset);
	}
}

function captureCanvasFrameWithReadback(
	canvas: HTMLCanvasElement,
	targetWidth?: number,
	targetHeight?: number,
	destBuffer?: Uint8Array,
): Uint8Array {
	const outWidth = targetWidth ?? canvas.width;
	const outHeight = targetHeight ?? canvas.height;
	const context = getFallbackReadbackContext(outWidth, outHeight);
	context.clearRect(0, 0, outWidth, outHeight);
	context.drawImage(canvas, 0, 0, outWidth, outHeight);
	const imageData = context.getImageData(0, 0, outWidth, outHeight);
	const target =
		destBuffer && destBuffer.byteLength === imageData.data.byteLength
			? destBuffer
			: acquireNativeFrameBuffer(imageData.data.byteLength);
	target.set(imageData.data);
	return target;
}

export async function captureCanvasFrameForNativeExport(
	canvas: HTMLCanvasElement,
	timestamp: number,
	flipVertical = false,
	targetWidth?: number,
	targetHeight?: number,
	existingBuffer?: Uint8Array,
): Promise<Uint8Array> {
	const outWidth = targetWidth ?? canvas.width;
	const outHeight = targetHeight ?? canvas.height;
	const neededBytes = getRgbaByteSize(outWidth, outHeight);
	const buffer =
		existingBuffer && existingBuffer.byteLength === neededBytes
			? existingBuffer
			: acquireNativeFrameBuffer(neededBytes);

	if (nativeFrameCaptureMode !== "canvas-readback") {
		const frame = new VideoFrame(canvas, { timestamp });

		try {
			await frame.copyTo(buffer, {
				format: "RGBA",
				layout: getRgbaLayout(outWidth),
			});
			if (flipVertical) {
				flipRgbaRowsInPlace(buffer, outWidth, outHeight);
			}
			nativeFrameCaptureMode = "video-frame-rgba";
			return buffer;
		} catch (error) {
			nativeFrameCaptureMode = "canvas-readback";
			if (!nativeFrameCaptureFallbackWarned) {
				nativeFrameCaptureFallbackWarned = true;
				console.warn(
					"[native-export] VideoFrame RGBA copyTo failed, falling back to canvas readback",
					error,
				);
			}
		} finally {
			frame.close();
		}
	}

	const fallbackResult = captureCanvasFrameWithReadback(canvas, outWidth, outHeight, buffer);
	if (flipVertical) {
		flipRgbaRowsInPlace(fallbackResult, outWidth, outHeight);
	}
	return fallbackResult;
}
