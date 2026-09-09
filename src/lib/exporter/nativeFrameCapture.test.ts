import { describe, expect, it } from "vitest";
import {
	acquireNativeFrameBuffer,
	clearNativeFrameBufferPool,
	releaseNativeFrameBuffer,
} from "./nativeFrameCapture";

describe("nativeFrameCapture buffer pool", () => {
	it("acquires and recycles frame buffers cleanly without re-allocation", () => {
		clearNativeFrameBufferPool();

		const size = 1920 * 1080 * 4;
		const buf1 = acquireNativeFrameBuffer(size);
		expect(buf1.byteLength).toBe(size);

		// Release back into pool
		releaseNativeFrameBuffer(buf1);

		// Re-acquire should return the exact same buffer instance
		const buf2 = acquireNativeFrameBuffer(size);
		expect(buf2).toBe(buf1);

		clearNativeFrameBufferPool();
	});

	it("allocates new buffer if pool is empty", () => {
		clearNativeFrameBufferPool();

		const size = 1280 * 720 * 4;
		const bufA = acquireNativeFrameBuffer(size);
		const bufB = acquireNativeFrameBuffer(size);

		expect(bufA === bufB).toBe(false);
		expect(bufA.byteLength).toBe(size);
		expect(bufB.byteLength).toBe(size);

		releaseNativeFrameBuffer(bufA);
		releaseNativeFrameBuffer(bufB);
		clearNativeFrameBufferPool();
	});
});
