// "Add to calendar" for live sessions: a Google Calendar link and an .ics file
// (Apple Calendar, Outlook and most others open it).
const stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function googleCalendarUrl({ title, start, minutes = 30, details = "", location = "" }) {
  const end = new Date(new Date(start).getTime() + minutes * 60000);
  const q = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${stamp(start)}/${stamp(end)}`, details, location });
  return `https://calendar.google.com/calendar/render?${q}`;
}

export function downloadIcs({ id, title, start, minutes = 30, details = "", location = "" }) {
  const end = new Date(new Date(start).getTime() + minutes * 60000);
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Skillfirms//Live//EN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${id}@skillfirms`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(details)}`, `LOCATION:${esc(location)}`,
    "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", `DESCRIPTION:${esc(title)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "session.ics" });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
