#!/usr/bin/env node
// Prüfung vor jedem Push. Läuft ohne KI; für die Sichtbarkeitsprüfung wird GitHub abgefragt (Internet nötig).
// Aufruf im Repo-Ordner:  node tools/push_check.mjs [--oeffentlich]
//   --oeffentlich  für das öffentliche Repo: nur Demo-Daten (isDemo: true), keine Ordner import/, vertrieb/, archive/
//   ohne Schalter  für das interne Repo: das Repo muss bei GitHub privat sein
// Exit-Code 0 = in Ordnung, 1 = Push nicht erlaubt.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const publicRepo = process.argv.includes('--oeffentlich');
// Alle Dateien, die committet sind oder gerade zum Commit vorgemerkt sind
const files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
  .split('\n').filter(Boolean).filter((f) => !f.startsWith('node_modules/'));

const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'privater Schlüssel'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub-Token'],
  [/\bsk-[A-Za-z0-9_-]{20,}/, 'API-Schlüssel (sk-...)'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS-Schlüssel'],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/, 'Slack-Token'],
  [/(passwor[dt]|passwd|secret|api[_-]?key|token)\s*[:=]\s*["']?[^\s"']{8,}/i, 'Passwort oder Schlüssel als Wert'],
];
const SKIP_CONTENT = /\.(png|jpe?g|webp|gif|ico|pdf|zip|pptx|xlsx|woff2?)$/i;

// Veranstaltungen mit echten Daten, für die eine schriftliche Zustimmung vorliegt
let released = new Set();
try {
  released = new Set(JSON.parse(readFileSync('data/freigaben.json', 'utf8')).freigaben.map((f) => f.eventId));
} catch { /* keine Freigabeliste: nur Demo-Daten erlaubt */ }

const problems = [];
for (const f of files) {
  if (publicRepo && /^(import|vertrieb|archive)\//.test(f)) problems.push(`${f}: gehört ins interne Repo, nicht ins öffentliche`);
  if (/(^|\/)\.env(\.|$)/.test(f)) problems.push(`${f}: .env-Dateien dürfen nicht ins Repo`);
  if (SKIP_CONTENT.test(f) || f === 'tools/push_check.mjs') continue;
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  for (const [re, label] of SECRET_PATTERNS) {
    const m = text.match(re);
    if (m) problems.push(`${f}: mögliches Geheimnis (${label}): "${m[0].slice(0, 12)}..."`);
  }
  if (publicRepo && f.startsWith('data/events/') && f.endsWith('.json')) {
    try {
      const d = JSON.parse(text);
      if (f.endsWith('ankuendigung.json') && d.isDemo !== true && !released.has(d.id)) problems.push(`${f}: Ankündigung einer echten Veranstaltung ohne Eintrag in data/freigaben.json. Erst nach Zustimmung des Veranstalters veröffentlichen.`);
      if (d.event && d.event.isDemo !== true && !released.has(d.event.id)) problems.push(`${f}: echte Programmdaten ohne Eintrag in data/freigaben.json. Erst nach schriftlicher Zustimmung des Veranstalters veröffentlichen.`);
    } catch { problems.push(`${f}: kein gültiges JSON`); }
  }
}

// Sichtbarkeit des Repos bei GitHub prüfen (über curl, das auf dem Mac vorinstalliert ist)
function repoVisibility() {
  let remote;
  try { remote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim(); } catch { return { error: 'kein Git-Remote "origin"' }; }
  const m = remote.match(/github\.com[/:]([^/]+)\/([^/.]+)(\.git)?$/);
  if (!m) return { error: `Remote ist kein GitHub-Repo: ${remote}` };
  try {
    const out = execSync(`curl -s -m 15 -w "\\n%{http_code}" https://api.github.com/repos/${m[1]}/${m[2]}`, { encoding: 'utf8' });
    const code = out.slice(out.lastIndexOf('\n') + 1).trim();
    const body = out.slice(0, out.lastIndexOf('\n'));
    // 404 ohne Anmeldung heißt: von außen nicht sichtbar, also privat
    if (code === '404') return { repo: `${m[1]}/${m[2]}`, visibility: 'private' };
    if (code !== '200') return { error: `GitHub antwortet mit Status ${code}` };
    return { repo: `${m[1]}/${m[2]}`, visibility: JSON.parse(body).visibility };
  } catch (e) {
    return { error: `GitHub nicht erreichbar (${e.message.split('\n')[0]})` };
  }
}
const vis = repoVisibility();
if (vis.error) problems.push(`Sichtbarkeit des Repos nicht prüfbar: ${vis.error}. Bitte Internetverbindung prüfen und erneut starten.`);
else if (publicRepo && vis.visibility !== 'public') problems.push(`${vis.repo} ist "${vis.visibility}", erwartet war öffentlich (für GitHub Pages).`);
else if (!publicRepo && vis.visibility !== 'private') problems.push(`${vis.repo} ist "${vis.visibility}". Das interne Repo muss privat sein. Unter Settings > General > Danger Zone auf "Private" stellen.`);

if (problems.length) {
  console.log('PUSH NICHT ERLAUBT:');
  problems.forEach((p) => console.log(`  - ${p}`));
  process.exit(1);
}
console.log(`Push-Prüfung bestanden: ${files.length} Dateien geprüft, ${vis.repo} ist ${vis.visibility === 'public' ? 'öffentlich' : 'privat'}.`);
