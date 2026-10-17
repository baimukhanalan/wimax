import { afterEach, describe, expect, it } from "vitest";
import { deviceUserId, issueDeviceToken, issueMobileToken, issueSession, mobileUserId, productionAuthConfigured, sessionUserId, verifyDeviceToken, verifyMobileToken, verifySession } from "./session";

describe("signed web sessions", () => {
  afterEach(() => { delete process.env.MIRROR_SESSION_SECRET; delete process.env.MIRROR_WEB_PASSWORD; });
  it("accepts an unexpired signed token and rejects tampering", () => {
    process.env.MIRROR_SESSION_SECRET = "a".repeat(32);
    const token = issueSession("user-1", 1_000_000, 60);
    expect(verifySession(token, 1_010_000)).toBe(true);
    expect(sessionUserId(token, 1_010_000)).toBe("user-1");
    expect(verifySession(`${token}x`, 1_010_000)).toBe(false);
    expect(verifySession(token, 1_100_000)).toBe(false);
  });
  it("separates mobile bearer tokens from browser sessions", () => {
    process.env.MIRROR_SESSION_SECRET = "a".repeat(32);
    const token = issueMobileToken("user-2", 1_000_000, 60);
    expect(verifyMobileToken(token, 1_010_000)).toBe(true);
    expect(mobileUserId(token, 1_010_000)).toBe("user-2");
    expect(verifySession(token, 1_010_000)).toBe(false);
    expect(verifyMobileToken(`${token}x`, 1_010_000)).toBe(false);
  });
  it("remembers a browser without turning the device cookie into a session", () => {
    process.env.MIRROR_SESSION_SECRET = "a".repeat(32);
    const token = issueDeviceToken("user-3", 1_000_000, 60);
    expect(verifyDeviceToken(token, 1_010_000)).toBe(true);
    expect(deviceUserId(token, 1_010_000)).toBe("user-3");
    expect(verifySession(token, 1_010_000)).toBe(false);
    expect(verifyDeviceToken(`${token}x`, 1_010_000)).toBe(false);
  });
  it("requires both production secrets", () => {
    process.env.MIRROR_SESSION_SECRET = "b".repeat(32);
    expect(productionAuthConfigured()).toBe(false);
    process.env.MIRROR_WEB_PASSWORD = "private";
    expect(productionAuthConfigured()).toBe(true);
  });
});
