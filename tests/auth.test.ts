/**
 * Layer 10 proof (unit) — token issue/verify, type separation, tamper rejection.
 */
import { describe, expect, it } from "vitest";
import { issueTokens, verifyAccess, verifyRefresh } from "@/lib/auth/tokens";
import { isAppError } from "@/lib/errors";

describe("Layer 10 — app tokens", () => {
  it("issues and verifies an access token with role", async () => {
    const { accessToken } = await issueTokens("user-1", "developer");
    const claims = await verifyAccess(accessToken);
    expect(claims.sub).toBe("user-1");
    expect(claims.role).toBe("developer");
  });

  it("rejects using a refresh token as an access token", async () => {
    const { refreshToken } = await issueTokens("user-1", "tester");
    await expect(verifyAccess(refreshToken)).rejects.toSatisfy(
      (e) => isAppError(e) && e.category === "unauthorized"
    );
    const r = await verifyRefresh(refreshToken);
    expect(r.role).toBe("tester");
  });

  it("rejects a tampered token", async () => {
    const { accessToken } = await issueTokens("user-1", "tester");
    const tampered = accessToken.slice(0, -3) + "abc";
    await expect(verifyAccess(tampered)).rejects.toThrow();
  });
});
