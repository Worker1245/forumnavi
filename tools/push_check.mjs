#!/usr/bin/env node
// Prüfung vor jedem Push. Läuft ohne KI und ohne Netzwerk.
// Aufruf im Repo-Ordner:  node tools/push_check.mjs [--oeffentlich]
//   --oeffentlich  zusätzlich: nur Demo-Daten (isDemo: true) erlaubt, keine Ordner import/, vertrieb/, archive/
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
const SKIP_CONTENT = /\.(png|jpe?g|webp|gif|ico|pdf|zip|pptx|woff2?)$/i;

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
      if (d.event && d.event.isDemo !== true) problems.push(`${f}: keine Demo-Daten (isDemo ist nicht true). Echte Programmdaten nur nach Freigabe des Veranstalters.`);
    } catch { problems.push(`${f}: kein gültiges JSON`); }
  }
}

if (problems.length) {
  console.log('PUSH NICHT ERLAUBT:');
  problems.forEach((p) => console.log(`  - ${p}`));
  process.exit(1);
}
console.log(`Push-Prüfung bestanden: ${files.length} Dateien geprüft${publicRepo ? ' (öffentliches Repo)' : ''}.`);
