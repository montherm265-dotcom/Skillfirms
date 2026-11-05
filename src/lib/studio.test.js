import { describe, expect, it } from "vitest";
import { videoEmbed } from "./studio";

describe("video links", () => {
  it("embeds YouTube, Vimeo and Loom; plays uploads; refuses the rest", () => {
    expect(videoEmbed("https://www.youtube.com/watch?v=abc123")).toEqual({ kind: "iframe", src: "https://www.youtube-nocookie.com/embed/abc123" });
    expect(videoEmbed("https://youtu.be/abc123").src).toBe("https://www.youtube-nocookie.com/embed/abc123");
    expect(videoEmbed("https://vimeo.com/76979871").src).toBe("https://player.vimeo.com/video/76979871");
    expect(videoEmbed("https://www.loom.com/share/0123abcd").src).toBe("https://www.loom.com/embed/0123abcd");
    expect(videoEmbed("https://x.supabase.co/storage/v1/object/public/course-videos/u/a.mp4").kind).toBe("video");
    expect(videoEmbed("https://evil.example.com/page")).toBeNull();
    expect(videoEmbed("javascript:alert(1)")).toBeNull();
  });
});
