import { describe, expect, it } from "vitest";
import { parsePrice } from "./plans";

describe("expert price input", () => {
  it("reads free and dollar amounts", () => {
    expect(parsePrice("Free")).toBe(0);
    expect(parsePrice("")).toBe(0);
    expect(parsePrice("49")).toBe(4900);
    expect(parsePrice("$19.99")).toBe(1999);
    expect(parsePrice("199")).toBe(19900);
  });
  it("refuses prices outside $9-$199 or odd text", () => {
    expect(parsePrice("5")).toBeNull();
    expect(parsePrice("200")).toBeNull();
    expect(parsePrice("12.345")).toBeNull();
    expect(parsePrice("ten")).toBeNull();
  });
});
