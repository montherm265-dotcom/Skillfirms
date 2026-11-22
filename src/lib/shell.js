// The homepage's top section is also written into index.html (#shell) so it
// appears before the app has loaded. These helpers hand over to the app.
export const shellShown = () => typeof document !== "undefined" && document.documentElement.classList.contains("shell");

export function dropShell() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("shell", "shell-home", "shell-courses");
  document.getElementById("shell")?.remove();
}

// Swap only after the browser has painted the shell at least once. The app's
// copy is identical, so the visitor sees no change, and the page's largest
// text is the one that arrived with the HTML instead of one drawn after the
// scripts load.
export function dropShellAfterPaint() {
  if (typeof window === "undefined" || !shellShown()) return dropShell();
  requestAnimationFrame(() => setTimeout(dropShell, 0));
}

// The full stylesheet arrives as media="print" so it never holds up the first
// paint (scripts/inline-shell.mjs). Switch it on, once loaded, before the app
// draws anything, so no page ever shows unstyled.
export function appStylesReady() {
  const link = typeof document !== "undefined" && document.getElementById("app-css");
  if (!link) return Promise.resolve();
  const on = () => { link.media = "all"; };
  if (link.sheet) { on(); return Promise.resolve(); }
  return new Promise((resolve) => {
    const done = () => { on(); resolve(); };
    link.addEventListener("load", done, { once: true });
    link.addEventListener("error", done, { once: true });
  });
}
