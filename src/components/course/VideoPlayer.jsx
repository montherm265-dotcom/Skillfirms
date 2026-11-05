import { videoEmbed } from "@/lib/studio";

export default function VideoPlayer({ url, title }) {
  const v = videoEmbed(url);
  if (!v) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-[0_30px_60px_-30px_hsl(var(--foreground)/0.5)]">
      <div className="relative aspect-video">
        {v.kind === "iframe" ? (
          <iframe src={v.src} title={title || "Lesson video"} className="absolute inset-0 h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
        ) : (
          <video src={v.src} controls playsInline preload="metadata" className="absolute inset-0 h-full w-full" />
        )}
      </div>
    </div>
  );
}
