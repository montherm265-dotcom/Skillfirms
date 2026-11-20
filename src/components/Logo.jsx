import { SF_MARK_PATH, SF_MARK_VIEWBOX } from "@/components/brand/sfMark";

// The SF mark, in the current text colour (dark on light, white on navy).
export default function Logo({ className = "h-[18px] w-auto" }) {
  return (
    <svg viewBox={SF_MARK_VIEWBOX} className={className} fill="currentColor" aria-hidden="true">
      <path d={SF_MARK_PATH} />
    </svg>
  );
}
