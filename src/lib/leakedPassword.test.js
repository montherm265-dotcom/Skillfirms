import { describe, expect, it } from "vitest";
import { assertPasswordNotLeaked, breachCount, sha1Hex } from "./leakedPassword";

const fakeFetch = (body, ok = true) => async () => ({ ok, text: async () => body });

describe("leaked password check", () => {
  it("hashes like standard SHA-1", () => {
    expect(sha1Hex("password")).toBe("5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8");
    expect(sha1Hex("")).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    expect(sha1Hex("héllo wörld ✓")).toHaveLength(40);
  });
  it("sends only the first 5 characters and matches the rest locally", async () => {
    let asked = null;
    const n = await breachCount("password", async (url) => { asked = url; return { ok: true, text: async () => "1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\r\nABC:1" }; });
    expect(asked).toBe("https://api.pwnedpasswords.com/range/5BAA6");
    expect(n).toBe(9545824);
  });
  it("lets the password through when it isn't listed or the check can't run", async () => {
    expect(await breachCount("password", fakeFetch("ABC:1"))).toBe(0);
    expect(await breachCount("password", fakeFetch("", false))).toBe(0);
    expect(await breachCount("password", async () => { throw new Error("offline"); })).toBe(0);
    await expect(assertPasswordNotLeaked("password", fakeFetch("1E4C9B93F3F0682250B6CF8331B7EE68FD8:3"))).rejects.toThrow(/data breach/);
  });
});
