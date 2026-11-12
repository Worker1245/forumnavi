// Rechtliche Seiten: Programmstand anzeigen und Rücksprung samt Merkliste ermöglichen.
const params = new URLSearchParams(location.search);
const back = `./${params.get('e') ? `?e=${encodeURIComponent(params.get('e'))}` : ''}${location.hash}`;
document.querySelectorAll('.zurueck').forEach((a) => { a.href = back; });
document.querySelectorAll('.rechtliches a').forEach((a) => {
  a.href = `${a.getAttribute('href')}${location.search}${location.hash}`;
});

fetch('events/index.json', { cache: 'no-cache' })
  .then((r) => r.json())
  .then((index) => {
    const ev = index.events.find((e) => e.id === params.get('e')) || (index.events.length === 1 ? index.events[0] : null);
    if (!ev) return;
    const f = new Intl.DateTimeFormat('de-DE', { timeZone: ev.timezone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const text = `${ev.name} · Programmstand vom ${f.format(new Date(ev.programStatus.date))} Uhr`;
    document.querySelectorAll('.stand').forEach((el) => { el.textContent = text; });
  })
  .catch(() => {});
