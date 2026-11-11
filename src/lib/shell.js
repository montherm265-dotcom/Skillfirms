// The homepage's top section is also written into index.html (#shell) so it
// appears before the app has loaded. These helpers hand over to the app.
export const shellShown = () => typeof document !== "undefined" && document.documentElement.classList.contains("shell");

export function dropShell() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("shell");
  document.getElementById("shell")?.remove();
}
