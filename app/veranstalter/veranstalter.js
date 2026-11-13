// Veranstalter-Demo: klickbarer Rundgang durch den geplanten Veranstalter-Bereich.
// Arbeitet nur mit erfundenen Demo-Daten im Browser. Speichert und überträgt nichts.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const announce = (m) => { const a = $('#ansage'); a.textContent = ''; setTimeout(() => { a.textContent = m; }, 50); };

const SCHRITTE = ['Anmelden', 'Hochladen', 'Preis', 'Bezahlen', 'Aufbereitung', 'Prüfen', 'Codes', 'Pläne', 'Sponsoren', 'Aktivieren'];
const STUFEN = [['S', 150, '490 €'], ['M', 500, '990 €'], ['L', 1500, '1.490 €'], ['XL', Infinity, '1.990 €']];
const VERGEBEN = new Set(['WIND26', 'DEMO', 'TEST', 'ADMIN', 'EVENTS', 'VERANSTALTER', 'IMPRESSUM', 'DATENSCHUTZ']);
let schritt = 1;
let daten = null;
let codes = [];

function zeige(n) {
  schritt = n;
  $$('.vb-schritt').forEach((s) => { s.hidden = Number(s.dataset.schritt) !== n; });
  $('#schritt-liste').innerHTML = SCHRITTE.map((t, i) => `<li${i + 1 === n ? ' aria-current="step"' : ''}${i + 1 < n ? ' class="erledigt"' : ''}>${t}<span class="sr-only">${i + 1 < n ? ' (erledigt)' : ''}</span></li>`).join('');
  const h = $(`.vb-schritt[data-schritt="${n}"] h2`);
  h.setAttribute('tabindex', '-1');
  h.focus();
  window.scrollTo(0, 0);
  if (n === 3) zaehlen();
  if (n === 5) aufbereiten();
  if (n === 6) pruefen();
  if (n === 9) sponsorVorschau();
}

async function ladeDaten() {
  if (!daten) daten = await (await fetch('../events/demo-energietage-2027/data.json')).json();
  return daten;
}

async function zaehlen() {
  const box = $('#vb-zaehlung');
  box.textContent = 'Programm wird gezählt …';
  const d = await ladeDaten();
  await new Promise((r) => setTimeout(r, 700));
  const n = d.sessions.length;
  const [stufe, , preis] = STUFEN.find(([, max]) => n <= max);
  box.innerHTML = `Gezählt: <strong>${n} Programmpunkte</strong> an ${d.days.length} Tagen in ${d.forums.length} Foren. Ihr Preis: <strong>Stufe ${stufe}, ${preis}</strong> zzgl. USt.`;
  $$('#vb-preise tr[data-stufe]').forEach((tr) => tr.classList.toggle('aktiv-stufe', tr.dataset.stufe === stufe));
  $('#vb-stufe-name').textContent = stufe;
  $('#vb-stufe-preis').textContent = preis;
  announce(`Ihr Preis: Stufe ${stufe}, ${preis}`);
}

async function aufbereiten() {
  const d = await ladeDaten();
  const log = $('#vb-protokoll');
  const bar = $('#vb-balken');
  const pb = $('.vb-fortschritt');
  log.innerHTML = '';
  $('#vb-weiter-5').hidden = true;
  const schritte = [
    'Programmheft gelesen (25 Seiten)',
    `${d.days.length} Tage und ${d.forums.length} Foren erkannt`,
    `${d.sessions.length} Programmpunkte und ${d.speakers.length} Personen übernommen`,
    'Automatische Prüfung: Uhrzeiten, Räume, Doppelungen',
    'Fertig: 7 Stellen zum Prüfen markiert',
  ];
  for (let i = 0; i < schritte.length; i++) {
    await new Promise((r) => setTimeout(r, 650));
    log.insertAdjacentHTML('beforeend', `<li>${esc(schritte[i])}</li>`);
    const p = Math.round(((i + 1) / schritte.length) * 100);
    bar.style.width = `${p}%`;
    pb.setAttribute('aria-valuenow', String(p));
  }
  $('#vb-weiter-5').hidden = false;
}

async function pruefen() {
  const d = await ladeDaten();
  const forum = (id) => d.forums.find((f) => f.id === id);
  const room = (id) => d.rooms.find((r) => r.id === id);
  const geaendert = d.sessions.filter((s) => s.status !== 'geplant');
  const punkte = [
    ...geaendert.map((s) => ({ art: 'Status', text: `${forum(s.forumId).kind === 'plenum' ? forum(s.forumId).title : 'Forum ' + forum(s.forumId).number}, ${s.start.slice(11)} Uhr: als „${s.status}“ markiert${s.statusNote ? ` (${s.statusNote})` : ''}. Bitte bestätigen.` })),
    { art: 'Titel', text: 'Forum 6, 11:10 Uhr: Titel ging über zwei Zeilen und wurde zusammengesetzt.' },
    { art: 'Übernommen', text: 'Schwerpunkte und Themen stehen nicht im Programmheft. Bitte zuordnen oder leer lassen.' },
  ];
  $('#vb-pruefliste').innerHTML = punkte.map((p, i) => `<li><input type="checkbox" id="pp${i}"><label for="pp${i}"><span class="art">${esc(p.art)}:</span> ${esc(p.text)}</label></li>`).join('');
  const zeilen = d.sessions.filter((s) => s.forumId === 'forum-14').slice(0, 6);
  $('#vb-edit tbody').innerHTML = zeilen.map((s, i) => `<tr>
    <td>${s.start.slice(11)}–${s.end.slice(11)}</td>
    <td>${esc(forum(s.forumId).number)}</td>
    <td><label class="sr-only" for="t${i}">Titel</label><input id="t${i}" type="text" value="${esc(s.title)}"></td>
    <td><label class="sr-only" for="r${i}">Raum</label><select id="r${i}">${d.rooms.map((r) => `<option${r.id === (s.roomId || forum(s.forumId).roomId) ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></td>
    <td><label class="sr-only" for="st${i}">Status</label><select id="st${i}">${['geplant', 'geändert', 'entfällt'].map((x) => `<option${x === s.status ? ' selected' : ''}>${x}</option>`).join('')}</select></td>
  </tr>`).join('');
  void room;
}

function zeigeCodes() {
  $('#vb-codes').innerHTML = codes.map((c) => `<li>${esc(c)} <button type="button" data-entfernen="${esc(c)}" aria-label="Code ${esc(c)} entfernen">×</button></li>`).join('');
}

function sponsorVorschau() {
  const name = $('#vb-sponsor').value.trim() || 'Sponsor';
  const text = $('#vb-text').value.trim();
  const datei = $('#vb-logo').files[0];
  const box = $('#vb-anzeige-vorschau');
  const render = (logo) => {
    box.innerHTML = `<div class="anzeige anzeige-banner"><span class="anzeige-label">Anzeige</span>${logo ? `<img src="${logo}" alt="${esc(name)}" style="height:40px;width:auto">` : `<strong>${esc(name)}</strong>`}${text ? `<span class="anzeige-text">${esc(text)}</span>` : ''}</div>`;
  };
  if (datei) {
    if (datei.size > 200 * 1024) { box.innerHTML = '<p class="fehler">Das Logo ist größer als 200 KB und würde abgelehnt.</p>'; return; }
    if (!/\.(svg|png|webp)$/i.test(datei.name)) { box.innerHTML = '<p class="fehler">Erlaubt sind SVG, PNG und WebP.</p>'; return; }
    const url = URL.createObjectURL(datei);
    render(url);
  } else render(null);
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.hasAttribute('data-weiter')) return zeige(schritt + 1);
  if (b.dataset.entfernen) { codes = codes.filter((c) => c !== b.dataset.entfernen); zeigeCodes(); announce(`Code ${b.dataset.entfernen} entfernt`); return; }
  if (b.id === 'vb-aktivieren') {
    $('#vb-status').textContent = 'Aktiv'; $('#vb-status').classList.add('an');
    b.hidden = true; $('#vb-deaktivieren').hidden = false;
    $('#vb-status-text').textContent = `Ihr Programm ist jetzt unter ${codes.length ? codes.join(', ') : 'Ihrem Code'} erreichbar.`;
    return;
  }
  if (b.id === 'vb-deaktivieren') {
    $('#vb-status').textContent = 'Nicht aktiv'; $('#vb-status').classList.remove('an');
    b.hidden = true; $('#vb-aktivieren').hidden = false;
    $('#vb-status-text').textContent = 'Deaktiviert. Teilnehmende sehen das Programm nicht mehr.';
    return;
  }
  if (b.id === 'vb-neu') { codes = []; zeigeCodes(); zeige(1); }
});

$('#vb-code-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = $('#vb-code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const out = $('#vb-code-meldung');
  if (code.length < 4 || code.length > 12) { out.textContent = 'Ein Code hat 4 bis 12 Buchstaben oder Ziffern.'; return; }
  if (VERGEBEN.has(code) || codes.includes(code)) { out.textContent = `„${code}“ ist schon vergeben. Bitte einen anderen Code wählen.`; return; }
  codes.push(code);
  zeigeCodes();
  $('#vb-code').value = '';
  out.textContent = `„${code}“ ist frei und für Sie reserviert.${/[0O1IL]/.test(code) ? ' Hinweis: 0/O oder 1/I/L werden leicht verwechselt.' : ''}`;
});

// Pläne: Prüfung nur im Browser (Größe, PDF-Kennung, eingebettete Skripte)
$('#vb-dok-datei').addEventListener('change', async () => {
  const f = $('#vb-dok-datei').files[0];
  const out = $('#vb-dok-meldung');
  if (!f) return;
  const titel = $('#vb-dok-titel').value.trim() || f.name;
  const mb = f.size / 1024 / 1024;
  if (mb > 10) { out.textContent = `Abgelehnt: ${mb.toFixed(1)} MB, erlaubt sind 10 MB.`; return; }
  const text = new TextDecoder('latin1').decode(await f.arrayBuffer());
  if (!text.startsWith('%PDF-')) { out.textContent = 'Abgelehnt: Die Datei ist keine PDF-Datei.'; return; }
  if (/\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia)\b/.test(text)) { out.textContent = 'Abgelehnt: Das PDF enthält Skripte oder eingebettete Dateien.'; return; }
  const groesse = f.size < 1024 * 1024 ? `${Math.round(f.size / 1024)} KB` : `${mb.toFixed(1).replace('.', ',')} MB`;
  $('#vb-doks').insertAdjacentHTML('beforeend', `<li>${esc(titel)} <span class="leise">(PDF, ${groesse})</span></li>`);
  out.textContent = `Geprüft und hinzugefügt: ${titel}${mb > 3 ? '. Hinweis: über 3 MB, im Messe-WLAN langsam.' : ''}`;
  $('#vb-dok-datei').value = '';
});

['#vb-sponsor', '#vb-text', '#vb-logo', '#vb-flaeche'].forEach((s) => $(s).addEventListener('input', sponsorVorschau));
$('#vb-logo').addEventListener('change', sponsorVorschau);

zeige(1);
// Beim ersten Aufruf nicht in die Seite springen
window.scrollTo(0, 0);
