import { Globe } from "lucide-react";
import { LANGUAGES, currentLang, setLang } from "@/lib/i18n";

// English, Español, Français, العربية. Each name is shown in its own
// language, so it's never translated.
export default function LanguagePicker({ className = "" }) {
  const lang = currentLang();
  return (
    <label data-no-translate className={`inline-flex items-center gap-1.5 text-sm ${className}`}>
      <Globe className="h-4 w-4 opacity-70" aria-hidden />
      <span className="sr-only">Language</span>
      <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language"
        className="cursor-pointer rounded-md border border-white/15 bg-transparent px-2 py-1 text-sm text-inherit outline-none focus:ring-2 focus:ring-[#6b8cff]">
        {LANGUAGES.map((l) => <option key={l.code} value={l.code} className="text-black">{l.name}</option>)}
      </select>
    </label>
  );
}
