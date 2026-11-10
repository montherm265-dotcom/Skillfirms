import { motion, useReducedMotion } from "framer-motion";
import welcome from "@/assets/mascot/welcome.webp";
import laptop from "@/assets/mascot/laptop.webp";
import pointing from "@/assets/mascot/pointing.webp";
import relax from "@/assets/mascot/relax.webp";
import celebrate from "@/assets/mascot/celebrate.webp";
import thinking from "@/assets/mascot/thinking.webp";
import support from "@/assets/mascot/support.webp";
import walking from "@/assets/mascot/walking.webp";
import reading from "@/assets/mascot/reading.webp";
import globe from "@/assets/mascot/globe.webp";
import chart from "@/assets/mascot/chart.webp";
import notify from "@/assets/mascot/notify.webp";
import tablet from "@/assets/mascot/tablet.webp";
import thumbsup from "@/assets/mascot/thumbsup.webp";
import dream from "@/assets/mascot/dream.webp";
import cv from "@/assets/mascot/cv.webp";

export const POSES = { welcome, laptop, pointing, relax, celebrate, thinking, support, walking, reading, globe, chart, notify, tablet, thumbsup, dream, cv };

// Tal, the Talfirms mascot. A soft shadow underneath and a slow idle float,
// so he feels alive without pulling focus. Decorative unless given a label.
// Poses with a desk or seat cut out of the art: soften the cut edges.
const FADE = {
  laptop: "linear-gradient(to right, transparent 0%, black 14%, black 86%, transparent 100%), linear-gradient(to bottom, black 70%, transparent 100%)",
  pointing: "linear-gradient(to bottom, black 82%, transparent 100%)",
  relax: "linear-gradient(to bottom, black 85%, transparent 100%)",
};

export default function Mascot({ pose = "welcome", className = "", float = true, shadow = true, label, delay = 0 }) {
  const reduce = useReducedMotion();
  return (
    <div className={`${/\b(absolute|fixed)\b/.test(className) ? "" : "relative "}${className}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {shadow && <div className="absolute inset-x-[18%] -bottom-1 h-[6%] rounded-[50%] bg-[#0a1433]/20 blur-md" />}
      <motion.img
        src={POSES[pose] ?? welcome}
        alt=""
        draggable={false}
        className="relative h-full w-full select-none object-contain"
        style={FADE[pose] ? { maskImage: FADE[pose], WebkitMaskImage: FADE[pose], maskComposite: "intersect", WebkitMaskComposite: "source-in" } : undefined}
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={reduce || !float ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: [0, -8, 0], scale: 1 }}
        transition={reduce || !float
          ? { duration: 0.6, delay }
          : { opacity: { duration: 0.6, delay }, scale: { duration: 0.6, delay }, y: { duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: delay + 0.6 } }}
      />
    </div>
  );
}
