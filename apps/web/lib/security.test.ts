import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { assertCaptureRequest, openSecret, sealSecret } from "./security";

describe("capture request boundary", () => {
  it("accepts a browser same-origin request", () => {
    const request = new NextRequest("https://mirror.example/api/capture", { headers: { origin: "https://mirror.example" } });
    expect(() => assertCaptureRequest(request)).not.toThrow();
  });

  it("rejects an untrusted cross-origin request without a token", () => {
    const request = new NextRequest("https://mirror.example/api/capture", { headers: { origin: "https://attacker.example" } });
    expect(() => assertCaptureRequest(request)).toThrow("UNAUTHORIZED");
  });

  it("rejects a request larger than the audio limit", () => {
    const request = new NextRequest("https://mirror.example/api/capture", { headers: { origin: "https://mirror.example", "content-length": String(26 * 1024 * 1024) } });
    expect(() => assertCaptureRequest(request)).toThrow("PAYLOAD_TOO_LARGE");
  });

  it("encrypts sensitive provider credentials with an authenticated envelope", () => {
    process.env.MIRROR_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const envelope = sealSecret("provider-refresh-token");
    expect(envelope).not.toContain("provider-refresh-token");
    expect(openSecret(envelope)).toBe("provider-refresh-token");
    delete process.env.MIRROR_ENCRYPTION_KEY;
  });
});
