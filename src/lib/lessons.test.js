import { describe, expect, it } from "vitest";
import { readingMinutes, toBlocks } from "./lessons";

describe("lesson text", () => {
  it("splits paragraphs and bullet lists", () => {
    const blocks = toBlocks("First para\nstill first.\n\n- one\n- two\n\nLead line\n- a\n- b");
    expect(blocks).toEqual([
      { type: "p", text: "First para still first." },
      { type: "list", items: ["one", "two"] },
      { type: "p", text: "Lead line" },
      { type: "list", items: ["a", "b"] },
    ]);
  });
  it("estimates reading time", () => {
    expect(readingMinutes({ summary: "x ".repeat(1100), sections: [] })).toBe(5);
    expect(readingMinutes(null)).toBeNull();
  });
});
