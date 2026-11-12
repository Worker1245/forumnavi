// Kalenderdatei (.ics, RFC 5545) im Browser erzeugen.
// Zeiten werden als Ortszeit mit Zeitzone (TZID) geschrieben, damit Kalender
// auf Geräten in anderen Zeitzonen richtig umrechnen.

// Mitteleuropäische Zeit mit Sommerzeit (gilt für Berlin, Wien, Zürich)
function vtimezone(tz) {
  return [
    'BEGIN:VTIMEZONE', `TZID:${tz}`,
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST',
    'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET',
    'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
    'END:VTIMEZONE',
  ];
}

const text = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const local = (dt) => dt.replace(/[-:]/g, '') + '00'; // 2027-11-09T11:05 -> 20271109T110500

function utcStamp(d = new Date()) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Zeilen länger als 75 Byte umbrechen (UTF-8-sicher)
function fold(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) {
      out.push(cur);
      cur = ' ';
      bytes = 1;
      limit = 75;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

// sessions: aufbereitete Programmpunkte (mit forum, room, speakers)
// ctx: { event, calendarNote, statusText, appUrl, name }
export function buildIcs(sessions, ctx) {
  const ev = ctx.event;
  const tz = ev.timezone;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Forumnavi//Programm//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${text(ctx.name || ev.name)}`, `X-WR-TIMEZONE:${tz}`,
    ...vtimezone(tz),
  ];
  const stamp = utcStamp();
  const venue = [ev.location.venue, ev.location.street, [ev.location.postalCode, ev.location.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  for (const s of sessions) {
    const desc = [];
    desc.push(`${s.forum.kind === 'plenum' ? '' : 'Forum '}${s.forum.number}: ${s.forum.title}`);
    if (s.speakers.length) desc.push(`Mit: ${s.speakers.map((p) => p.label).join('; ')}`);
    if (s.description) desc.push('', s.description);
    if (s.status !== 'geplant') desc.push('', `Status: ${s.status}${s.statusNote ? ` (${s.statusNote})` : ''}`);
    desc.push('', ctx.statusText);
    if (ctx.calendarNote) desc.push('', `Anzeige: ${ctx.calendarNote}`);
    if (ctx.appUrl) desc.push('', `Aktuelles Programm: ${ctx.appUrl}`);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id}@${ev.id}.forumnavi`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${tz}:${local(s.start)}`,
      `DTEND;TZID=${tz}:${local(s.end)}`,
      `SUMMARY:${text((s.status === 'entfällt' ? 'ENTFÄLLT: ' : '') + s.title)}`,
      `LOCATION:${text([s.room?.name, venue].filter(Boolean).join(', '))}`,
      `DESCRIPTION:${text(desc.join('\n'))}`,
      `STATUS:${s.status === 'entfällt' ? 'CANCELLED' : 'CONFIRMED'}`,
      'TRANSP:OPAQUE',
    );
    if (ctx.appUrl) lines.push(`URL:${ctx.appUrl}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
