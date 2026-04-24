import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { downloadToTemp } from "./urlDownloader.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("downloadToTemp", () => {
  it("rejects when the response stream errors during download", async () => {
    const destDir = mkdtempSync(join(tmpdir(), "hf-url-download-"));
    globalThis.fetch = vi.fn(async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          queueMicrotask(() => controller.error(new TypeError("terminated")));
        },
      });
      return new Response(body, { status: 200 });
    }) as typeof fetch;

    try {
      await expect(downloadToTemp("https://cdn.example.com/clip.mp4", destDir)).rejects.toThrow(
        /terminated/,
      );
    } finally {
      rmSync(destDir, { recursive: true, force: true });
    }
  });
});
