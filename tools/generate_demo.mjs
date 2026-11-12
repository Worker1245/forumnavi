#!/usr/bin/env node
// Erzeugt die ERFUNDENE Beispielveranstaltung für die Demo.
// Alle Namen von Personen, Firmen, Verbänden und Orten sind frei erfunden.
// Ähnlichkeiten mit echten Personen oder Organisationen sind zufällig.
// Das Ergebnis ist deterministisch (fester Zufallsstartwert): gleicher Lauf, gleiche Datei.
//
// Aufruf: node tools/generate_demo.mjs [--version JJJJ-MM-TT_NN] [--stand ISO-Zeitpunkt]

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : def;
};
const VERSION = arg('--version', '2026-11-12_01');
const STAND = arg('--stand', '2026-11-12T23:30:00+01:00');
const EVENT_ID = 'demo-energietage-2027';
const outDir = resolve(here, '../data/events', EVENT_ID);

// Deterministischer Zufall (mulberry32)
let seed = 20271109;
function rnd() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

// ---------- Stammdaten ----------
const DAYS = [
  { id: 'tag-1', date: '2027-11-09' },
  { id: 'tag-2', date: '2027-11-10' },
  { id: 'tag-3', date: '2027-11-11' },
];
const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
for (const d of DAYS) {
  const dt = new Date(`${d.date}T12:00:00Z`);
  d.label = `${WEEKDAYS[dt.getUTCDay()]}, ${dt.getUTCDate()}. ${MONTHS[dt.getUTCMonth()]}`;
}

const ROOMS = [
  { id: 'plenarsaal', name: 'Plenarsaal', floor: 'EG' },
  { id: 'saal-1', name: 'Saal 1', floor: 'EG' },
  { id: 'saal-2', name: 'Saal 2', floor: 'EG' },
  { id: 'saal-3', name: 'Saal 3', floor: '1. OG' },
  { id: 'saal-4', name: 'Saal 4', floor: '1. OG' },
  { id: 'raum-elbe', name: 'Raum Elbe', floor: '1. OG' },
  { id: 'raum-havel', name: 'Raum Havel', floor: '2. OG' },
  { id: 'raum-ostufer', name: 'Raum Ostufer', floor: '2. OG' },
];

const TOPICS = [
  ['genehmigung', 'Genehmigung'],
  ['repowering', 'Repowering'],
  ['netz', 'Netzanschluss und Netze'],
  ['naturschutz', 'Natur- und Artenschutz'],
  ['akzeptanz', 'Akzeptanz und Beteiligung'],
  ['vermarktung', 'Vermarktung und PPA'],
  ['betrieb', 'Betrieb und Wartung'],
  ['recht', 'Recht'],
  ['speicher', 'Speicher und Sektorkopplung'],
  ['finanzierung', 'Finanzierung und Versicherung'],
  ['digital', 'Digitalisierung und Daten'],
  ['rueckbau', 'Rückbau und Recycling'],
  ['flaeche', 'Flächen und Planung'],
  ['technik', 'Anlagentechnik'],
  ['sicherheit', 'Arbeitssicherheit'],
  ['logistik', 'Transport und Logistik'],
].map(([id, label]) => ({ id, label }));

const ORGANIZERS = [
  ['aeolis', 'Fachverband Aeolis e.V.', 'Verband'],
  ['brenner-lohmeyer', 'Kanzlei Brenner Lohmeyer Partner', 'Kanzlei'],
  ['inf-feldhaus', 'Institut für Netzintegration Feldhaus', 'Forschung'],
  ['nordbrise', 'Nordbrise Projektentwicklung GmbH', 'Unternehmen'],
  ['kranwerk', 'Kranwerk Logistik AG', 'Unternehmen'],
  ['sw-musterstadt', 'Stadtwerke Musterstadt GmbH', 'Unternehmen'],
  ['avifauna-seidel', 'Gutachterbüro Avifauna Seidel', 'Unternehmen'],
  ['lea-musterland', 'Landesenergieagentur Musterland', 'Behörde'],
  ['bk-heide-sued', 'Betreiberkreis Heide-Süd e.V.', 'Verband'],
  ['rotorline', 'Rotorline Service GmbH', 'Unternehmen'],
  ['kapitalwind', 'Kapitalwind Finanzierungspartner AG', 'Unternehmen'],
  ['sektorlink', 'Sektorlink Speichersysteme GmbH', 'Unternehmen'],
  ['vogt-asmussen', 'Kanzlei Vogt & Asmussen', 'Kanzlei'],
  ['hs-musterstadt', 'Hochschule Musterstadt, Fachgebiet Windenergietechnik', 'Forschung'],
  ['be-talgrund', 'Bürgerenergie Talgrund eG', 'Sonstige'],
  ['gridvolt', 'Gridvolt Netzservice GmbH', 'Unternehmen'],
  ['fliegerwacht', 'Fliegerwacht Radartechnik GmbH', 'Unternehmen'],
  ['recyclon', 'Recyclon Rotorblattverwertung GmbH', 'Unternehmen'],
  ['datafeld', 'Datafeld Analytics GmbH', 'Unternehmen'],
  ['flaechenkontor', 'Flächenkontor Planungsgesellschaft mbH', 'Unternehmen'],
  ['boeenschutz', 'Böenschutz Versicherungskontor AG', 'Unternehmen'],
  ['ak-sicherheit', 'Arbeitskreis Sicherheit in der Windbranche', 'Verband'],
  ['demo-veranstalter', 'Demo-Veranstalter GmbH', 'Veranstalter'],
].map(([id, name, type]) => ({ id, name, type }));

// Foren: [Titel, Themen, Veranstalter, 4 Vortragstitel, Kurzbeschreibung]
const FORUMS = [
  // Tag 1
  ['Genehmigungsverfahren beschleunigen', ['genehmigung', 'recht'], ['aeolis'],
    ['Fristen im Genehmigungsverfahren: Erfahrungen aus dem ersten Jahr', 'Vollständigkeitsprüfung ohne Nachforderungsschleifen', 'Digitale Antragsunterlagen in der Praxis', 'Was Behörden von Projektierern brauchen'],
    'Wo Verfahren heute hängen und welche Stellschrauben Projektierer und Behörden selbst in der Hand haben.'],
  ['Repowering an Bestandsstandorten', ['repowering', 'genehmigung'], ['nordbrise'],
    ['Repowering-Potenziale im Altbestand bewerten', 'Änderungsgenehmigung oder Neugenehmigung?', 'Rückbau und Neubau zeitlich verzahnen', 'Fallbeispiel: Drei Altanlagen, eine neue Anlage'],
    'Erfahrungen mit dem Ersatz älterer Anlagen durch leistungsstärkere Technik.'],
  ['Netzanschluss: Kapazitäten und Wartezeiten', ['netz'], ['inf-feldhaus'],
    ['Netzanschlussbegehren richtig stellen', 'Überbauung von Netzverknüpfungspunkten', 'Gemeinsame Umspannwerke mehrerer Projekte', 'Datenlage zu freien Kapazitäten'],
    'Wie Projekte trotz knapper Netzkapazitäten ans Netz kommen.'],
  ['Artenschutz und Abschaltalgorithmen', ['naturschutz', 'technik'], ['avifauna-seidel'],
    ['Antikollisionssysteme im Feldtest', 'Fledermausabschaltung: Daten aus drei Betriebsjahren', 'Habitatpotenzialanalyse als Planungsinstrument', 'Ertragsverluste durch Abschaltauflagen beziffern'],
    'Technische und planerische Lösungen für den Schutz von Vögeln und Fledermäusen.'],
  ['Kommunale Teilhabe und Akzeptanz', ['akzeptanz'], ['be-talgrund'],
    ['Finanzielle Beteiligung von Gemeinden umsetzen', 'Bürgerstromtarife als Akzeptanzinstrument', 'Informationsabende, die funktionieren', 'Konflikte früh erkennen und moderieren'],
    'Wie Gemeinden und Anwohner vom Windpark vor Ort profitieren.'],
  ['Direktvermarktung und PPA', ['vermarktung'], ['sw-musterstadt'],
    ['PPA-Modelle für mittelgroße Windparks', 'Preisrisiken in langfristigen Lieferverträgen', 'Herkunftsnachweise richtig nutzen', 'Direktvermarktung bei negativen Preisen'],
    'Erlösmodelle jenseits der festen Vergütung.'],
  ['Schwertransporte und Baulogistik', ['logistik'], ['kranwerk'],
    ['Transportgenehmigungen für Großkomponenten', 'Zuwegung und Kranstellflächen planen', 'Logistik für Rotorblätter über 80 Meter', 'Bauzeitenplanung mit Wetterfenstern'],
    'Vom Hafen bis zur Kranstellfläche: Logistik großer Komponenten.'],
  ['Betriebsführung im Wandel', ['betrieb', 'digital'], ['bk-heide-sued'],
    ['Technische und kaufmännische Betriebsführung trennen?', 'Kennzahlen für Betreiber', 'Wechsel des Betriebsführers ohne Datenverlust', 'Betreiberpflichten nach Ende der Förderung'],
    'Aufgaben, Kennzahlen und Verträge in der Betriebsführung.'],
  ['Flächenausweisung in den Ländern', ['flaeche', 'recht'], ['lea-musterland'],
    ['Stand der Regionalplanung', 'Flächenziele und kommunale Steuerung', 'Sicherung von Flächen durch Pachtverträge', 'Konkurrierende Nutzungen auf ausgewiesenen Flächen'],
    'Wie Länder und Regionen Flächen ausweisen und was das für Projekte bedeutet.'],
  ['Radar, Luftfahrt und Wetterdienst', ['genehmigung', 'technik'], ['fliegerwacht'],
    ['Drehfunkfeuer und Anlagenschutzbereiche', 'Militärische Belange frühzeitig klären', 'Bedarfsgesteuerte Nachtkennzeichnung im Betrieb', 'Wetterradar und Windenergie'],
    'Luftverkehrliche Belange in Planung und Betrieb.'],
  ['Arbeitssicherheit auf der Anlage', ['sicherheit', 'betrieb'], ['ak-sicherheit'],
    ['Rettung aus der Gondel: Übungsergebnisse', 'Gefährdungsbeurteilung für Servicetechniker', 'Unterweisung mehrsprachiger Teams', 'Unfallanalyse: Was lässt sich lernen?'],
    'Schutz der Menschen, die auf und an Windenergieanlagen arbeiten.'],
  // Tag 2
  ['Rechtsprechung aktuell', ['recht', 'genehmigung'], ['brenner-lohmeyer'],
    ['Entscheidungen zum Immissionsschutzrecht', 'Klagen gegen Genehmigungen: Erfolgsquoten und Gründe', 'Denkmalschutz und Windenergie vor Gericht', 'Was die Urteile für laufende Verfahren bedeuten'],
    'Überblick über aktuelle Gerichtsentscheidungen mit Praxisbezug.'],
  ['Finanzierung von Windprojekten', ['finanzierung'], ['kapitalwind'],
    ['Bankenanforderungen an Ertragsgutachten', 'Eigenkapital von Bürgern und Kommunen', 'Finanzierung von Repowering-Projekten', 'Zinsumfeld und Projektrenditen'],
    'Was Kapitalgeber erwarten und wie Projekte finanzierbar bleiben.'],
  ['Speicher am Windpark', ['speicher', 'netz'], ['sektorlink'],
    ['Batteriespeicher am gemeinsamen Netzverknüpfungspunkt', 'Abregelung vermeiden durch Speicher', 'Erlösstapel für Co-Location-Speicher', 'Genehmigung von Großbatteriespeichern'],
    'Kombination von Windenergie und Batteriespeichern.'],
  ['Wasserstoff aus Windstrom', ['speicher', 'vermarktung'], ['sektorlink', 'sw-musterstadt'],
    ['Elektrolyse direkt am Windpark', 'Strombezugskriterien für grünen Wasserstoff', 'Wärmenutzung aus der Elektrolyse', 'Wirtschaftlichkeit kleiner Elektrolyseure'],
    'Ansätze, Windstrom in Wasserstoff umzuwandeln.'],
  ['Digitale Zwillinge und Zustandsüberwachung', ['digital', 'betrieb'], ['datafeld'],
    ['Schwingungsdaten für die Schadensfrüherkennung', 'Digitale Zwillinge von Rotorblättern', 'Datenzugang beim Hersteller verhandeln', 'Vom Alarm zur Instandsetzung'],
    'Daten aus dem Betrieb für Wartung und Ertrag nutzen.'],
  ['Weiterbetrieb nach 20 Jahren', ['betrieb', 'repowering'], ['rotorline'],
    ['Gutachten zum Weiterbetrieb', 'Ersatzteilversorgung für Altanlagen', 'Wirtschaftlichkeit des Weiterbetriebs', 'Weiterbetrieb oder Repowering: Entscheidungskriterien'],
    'Technische und wirtschaftliche Fragen bei älteren Anlagen.'],
  ['Schall, Schatten und Abstand', ['genehmigung', 'akzeptanz'], ['hs-musterstadt'],
    ['Schallprognosen für große Rotoren', 'Schattenwurfabschaltung in der Praxis', 'Optisch bedrängende Wirkung', 'Messkampagnen nach Inbetriebnahme'],
    'Immissionsschutzfragen von der Prognose bis zur Messung.'],
  ['Versicherung von Windparks', ['finanzierung', 'betrieb'], ['boeenschutz'],
    ['Schadenstatistik: Häufige Ursachen', 'Versicherbarkeit neuer Anlagentypen', 'Betriebsunterbrechung richtig absichern', 'Brandschutz und Versicherungsprämien'],
    'Risiken im Lebenszyklus eines Windparks absichern.'],
  ['Netzbetreiber im Dialog', ['netz'], ['gridvolt'],
    ['Redispatch aus Sicht der Anlagenbetreiber', 'Blindleistungsbereitstellung durch Windparks', 'Netzanschlusszusagen verbindlich machen', 'Kommunikation zwischen Netz- und Anlagenbetreiber'],
    'Zusammenarbeit von Netz- und Anlagenbetreibern.'],
  ['Pachtverträge und Flächensicherung', ['flaeche', 'recht'], ['vogt-asmussen'],
    ['Pachtmodelle mit Flächenpool', 'Laufzeiten und Verlängerungsoptionen', 'Dienstbarkeiten und Grundbuch', 'Konflikte zwischen Eigentümern lösen'],
    'Vertragliche Grundlagen für die Flächennutzung.'],
  ['Forum der Nachwuchskräfte', ['akzeptanz', 'technik'], ['hs-musterstadt'],
    ['Abschlussarbeit: Eisansatz an Rotorblättern', 'Abschlussarbeit: Akzeptanzbefragung in zwei Gemeinden', 'Berufseinstieg in der Projektierung', 'Fachkräfte gewinnen und halten'],
    'Junge Fachleute stellen Arbeiten vor und berichten vom Einstieg.'],
  // Tag 3
  ['Rückbau und Rotorblattrecycling', ['rueckbau'], ['recyclon'],
    ['Rückbaukosten realistisch kalkulieren', 'Verwertungswege für Rotorblätter', 'Fundamente: vollständiger oder teilweiser Rückbau?', 'Sicherheitsleistungen für den Rückbau'],
    'Was am Ende der Betriebszeit mit Anlagen und Material passiert.'],
  ['Anlagentechnik: Neue Plattformen', ['technik'], ['hs-musterstadt'],
    ['Entwicklung der Rotordurchmesser an Land', 'Hybridtürme und Stahltürme im Vergleich', 'Getriebe oder Direktantrieb?', 'Typenprüfung neuer Anlagentypen'],
    'Technische Entwicklungen bei Windenergieanlagen an Land.'],
  ['Ausschreibungen und Marktdesign', ['vermarktung', 'recht'], ['aeolis'],
    ['Auswertung der letzten Ausschreibungsrunden', 'Gebotsstrategie für mittelgroße Projekte', 'Realisierungsfristen und Pönalen', 'Diskussionsstand zum künftigen Marktdesign'],
    'Ausschreibungen, Zuschläge und die Entwicklung des Strommarkts.'],
  ['Wartung und Instandhaltung', ['betrieb', 'sicherheit'], ['rotorline'],
    ['Wartungsverträge im Vergleich', 'Rotorblattinspektion mit Drohnen', 'Großkomponententausch planen', 'Servicekapazitäten in der Hochsaison'],
    'Wartungskonzepte und Instandsetzung im Betrieb.'],
  ['Windenergie im Wald', ['flaeche', 'naturschutz'], ['flaechenkontor'],
    ['Standortwahl auf Kalamitätsflächen', 'Ausgleichsmaßnahmen im Forst', 'Brandschutz bei Anlagen im Wald', 'Erfahrungen mit Forstbehörden'],
    'Planung und Bau von Windenergieanlagen auf Waldflächen.'],
  ['Kommunikation in Konfliktfällen', ['akzeptanz'], ['be-talgrund', 'aeolis'],
    ['Umgang mit Falschinformationen vor Ort', 'Pressearbeit während der Bauphase', 'Beschwerdemanagement im Betrieb', 'Rolle der Bürgermeisterinnen und Bürgermeister'],
    'Wie Projektträger in schwierigen Situationen kommunizieren.'],
  ['Netzdienliche Windparks', ['netz', 'speicher'], ['inf-feldhaus', 'gridvolt'],
    ['Netzbildende Umrichter', 'Windparks als Regelleistungsanbieter', 'Systemdienstleistungen vergüten', 'Netzstabilität mit hohem Windanteil'],
    'Beiträge von Windparks zur Stabilität des Stromnetzes.'],
  ['Daten und IT-Sicherheit', ['digital', 'sicherheit'], ['datafeld'],
    ['Cyberangriffe auf Parkregler', 'Anforderungen an kritische Infrastruktur', 'Fernzugriff sicher organisieren', 'Notfallpläne für Steuerungsausfälle'],
    'Schutz von Steuerungs- und Betriebsdaten.'],
  ['Kreislaufwirtschaft in der Lieferkette', ['rueckbau', 'technik'], ['recyclon', 'kranwerk'],
    ['CO2-Bilanz einer Windenergieanlage', 'Recyclingfähige Rotorblätter', 'Gebrauchtanlagen im Zweitmarkt', 'Materialpässe für Komponenten'],
    'Ressourcen schonen vom Bau bis zur Verwertung.'],
  ['Genehmigungsbehörden im Gespräch', ['genehmigung'], ['lea-musterland'],
    ['Personalausstattung der Behörden', 'Standardisierte Prüfvorlagen', 'Externe Projektmanager im Verfahren', 'Erfahrungsaustausch zwischen Landkreisen'],
    'Behördenvertreter berichten aus ihrer Arbeit.'],
  ['Bürgerenergie und Genossenschaften', ['akzeptanz', 'finanzierung'], ['be-talgrund'],
    ['Gründung einer Energiegenossenschaft', 'Bürgerwindpark mit Kommune als Partner', 'Mitgliederwerbung und Informationspflichten', 'Regionale Stromvermarktung durch Genossenschaften'],
    'Wie Bürgerinnen und Bürger selbst Windparks betreiben.'],
];

const PLENA = [
  ['Eröffnung und Keynote', [['Begrüßung', 'Begrüßung'], ['Windenergie an Land: Bilanz und Ausblick', 'Keynote'], ['Podium: Was die nächsten Jahre bringen', 'Diskussion']]],
  ['Plenum am zweiten Tag', [['Einführung in den Tag', 'Begrüßung'], ['Netze, Speicher, Märkte: Wie das System zusammenwächst', 'Keynote'], ['Podium: Akzeptanz als Standortfaktor', 'Diskussion']]],
  ['Plenum am dritten Tag', [['Einführung in den Tag', 'Begrüßung'], ['Lebenszyklus einer Windenergieanlage', 'Keynote'], ['Abschlussdiskussion', 'Diskussion']]],
];

const FIRST_F = ['Anna', 'Lena', 'Miriam', 'Sarah', 'Katrin', 'Johanna', 'Nele', 'Svenja', 'Carla', 'Ines', 'Paula', 'Greta', 'Hanna', 'Leonie', 'Esra'];
const FIRST_M = ['Jonas', 'Felix', 'Tobias', 'Lukas', 'Malte', 'Henrik', 'Florian', 'Moritz', 'Jannik', 'Ole', 'Timo', 'Niklas', 'Bastian', 'Fabian', 'Kerem'];
const LAST = ['Albrecht', 'Brandt', 'Claßen', 'Dittmer', 'Eggers', 'Frerichs', 'Gabler', 'Hinrichs', 'Iwersen', 'Jürgensen', 'Kehler', 'Lüders', 'Mahnke', 'Nolting', 'Oltmanns', 'Pannek', 'Quast', 'Rehder', 'Sommerfeld', 'Tietjen', 'Uhlig', 'Voß', 'Wendt', 'Yıldız', 'Zander', 'Bartels', 'Carstens', 'Dreyer', 'Ebeling', 'Fehrs'];
// Funktionen: [weibliche Form, männliche Form]
const POSITIONS = [
  ['Geschäftsführerin', 'Geschäftsführer'], ['Projektleiterin', 'Projektleiter'], ['Referentin Energiepolitik', 'Referent Energiepolitik'],
  ['Referentin Netzplanung', 'Referent Netzplanung'], ['Leiterin Technik', 'Leiter Technik'], ['Rechtsanwältin', 'Rechtsanwalt'],
  ['Gutachterin', 'Gutachter'], ['Leiterin Betriebsführung', 'Leiter Betriebsführung'], ['Wissenschaftliche Mitarbeiterin', 'Wissenschaftlicher Mitarbeiter'],
  ['Vertriebsleiterin', 'Vertriebsleiter'], ['Fachbereichsleiterin', 'Fachbereichsleiter'], ['Vorständin', 'Vorstand'], ['Teamleiterin Genehmigung', 'Teamleiter Genehmigung'],
];
const EXTRA_AFFILIATIONS = ['Windpark Hohe Geest GmbH & Co. KG', 'Landkreis Musterkreis', 'Ingenieurbüro Brisenfeld', 'Gemeinde Talgrund', 'Ertragsgutachten Lorenzen GmbH', 'Turmwerk Beton AG', 'Energiehandel Westmark GmbH', 'Umweltplanung Kranichried'];

// Referenten erzeugen: eindeutige Namen
const speakers = [];
const usedNames = new Set();
function newSpeaker(affiliation) {
  const female = rnd() < 0.5;
  let name;
  do { name = `${pick(female ? FIRST_F : FIRST_M)} ${pick(LAST)}`; } while (usedNames.has(name));
  usedNames.add(name);
  const id = `ref-${String(speakers.length + 1).padStart(3, '0')}`;
  const sp = { id, name, position: pick(POSITIONS)[female ? 0 : 1], affiliation };
  const r = rnd();
  if (r < 0.15) sp.academicTitle = 'Dr.';
  else if (r < 0.2) sp.academicTitle = 'Prof. Dr.';
  speakers.push(sp);
  return id;
}
const orgName = (id) => ORGANIZERS.find((o) => o.id === id).name;
const affiliationPool = [...ORGANIZERS.filter((o) => o.type !== 'Veranstalter').map((o) => o.name), ...EXTRA_AFFILIATIONS];

// ---------- Programm aufbauen ----------
const pad = (n) => String(n).padStart(2, '0');
const addMin = (hhmm, m) => {
  const [h, mi] = hhmm.split(':').map(Number);
  const t = h * 60 + mi + m;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
};

// Je Tag 11 Foren in zwei Blöcken: 6 + 5 parallel
const BLOCKS = [
  { start: '11:00', rooms: ['saal-1', 'saal-2', 'saal-3', 'saal-4', 'raum-elbe', 'raum-havel'] },
  { start: '14:30', rooms: ['saal-1', 'saal-2', 'saal-3', 'saal-4', 'raum-ostufer'] },
];

const forums = [];
const sessions = [];
let forumNo = 0;

DAYS.forEach((day, di) => {
  // Plenum
  const pId = `plenum-${di + 1}`;
  const [pTitle, pItems] = PLENA[di];
  const pMod = newSpeaker(orgName('demo-veranstalter'));
  forums.push({ id: pId, number: `P${di + 1}`, title: pTitle, kind: 'plenum', dayId: day.id, roomId: 'plenarsaal', organizerIds: ['demo-veranstalter'], moderatorIds: [pMod], topicIds: [] });
  let t = '09:00';
  const pLen = [15, 35, 40];
  pItems.forEach(([title, type], k) => {
    const speakerIds = type === 'Diskussion'
      ? [newSpeaker(pick(affiliationPool)), newSpeaker(pick(affiliationPool)), newSpeaker(pick(affiliationPool))]
      : [type === 'Begrüßung' ? pMod : newSpeaker(pick(affiliationPool))];
    sessions.push({ id: `${pId}-${k + 1}`, forumId: pId, title, type, start: `${day.date}T${t}`, end: `${day.date}T${addMin(t, pLen[k])}`, speakerIds, status: 'geplant' });
    t = addMin(t, pLen[k]);
  });

  // Foren
  const dayForums = FORUMS.slice(di * 11, di * 11 + 11);
  let fi = 0;
  for (const block of BLOCKS) {
    for (const roomId of block.rooms) {
      const [title, topicIds, organizerIds, talks, description] = dayForums[fi++];
      forumNo++;
      const fId = `forum-${pad(forumNo)}`;
      const mod = newSpeaker(orgName(organizerIds[0]));
      forums.push({ id: fId, number: String(forumNo), title, description, kind: 'forum', dayId: day.id, roomId, organizerIds, moderatorIds: [mod], topicIds });
      // Einführung 5 Min, 4 Vorträge à 15 Min, Diskussion 25 Min = 90 Min
      let ts = block.start;
      sessions.push({ id: `${fId}-0`, forumId: fId, title: `Einführung: ${title}`, type: 'Begrüßung', start: `${day.date}T${ts}`, end: `${day.date}T${addMin(ts, 5)}`, speakerIds: [mod], topicIds, status: 'geplant' });
      ts = addMin(ts, 5);
      talks.forEach((talk, k) => {
        const aff = k === 0 ? orgName(organizerIds[organizerIds.length - 1]) : pick(affiliationPool);
        const ids = [newSpeaker(aff)];
        if (rnd() < 0.2) ids.push(newSpeaker(aff));
        sessions.push({ id: `${fId}-${k + 1}`, forumId: fId, title: talk, type: 'Vortrag', start: `${day.date}T${ts}`, end: `${day.date}T${addMin(ts, 15)}`, speakerIds: ids, topicIds, status: 'geplant' });
        ts = addMin(ts, 15);
      });
      const panel = sessions.filter((s) => s.forumId === fId && s.type === 'Vortrag').flatMap((s) => s.speakerIds);
      sessions.push({ id: `${fId}-d`, forumId: fId, title: `Diskussion: ${title}`, type: 'Diskussion', start: `${day.date}T${ts}`, end: `${day.date}T${addMin(ts, 25)}`, speakerIds: [mod, ...panel], topicIds, status: 'geplant' });
    }
  }
});

// Beispiele für Programmänderungen, damit die Anzeige in der Demo sichtbar ist
const changed = sessions.find((s) => s.id === 'forum-06-2');
changed.status = 'geändert';
changed.statusNote = 'Neue Referentin';
const dropped = sessions.find((s) => s.id === 'forum-19-3');
dropped.status = 'entfällt';
dropped.statusNote = 'Vortrag entfällt ersatzlos';

// ---------- Sponsoren (erfunden) ----------
const SPONSORS = [
  { id: 'sp-windmuehle', name: 'Windmühle Beispiel AG', color: '#0b5d7a' },
  { id: 'sp-turmwerk', name: 'Turmwerk Beton AG', color: '#6b4e16' },
  { id: 'sp-netzfluss', name: 'Netzfluss GmbH', color: '#2e6b2e' },
  { id: 'sp-kapitalwind', name: 'Kapitalwind Finanzierungspartner AG', color: '#5a2d82' },
];
const sponsors = SPONSORS.map((s) => ({ id: s.id, name: s.name, logo: `sponsoren/${s.id}.svg`, url: 'https://example.com/' }));
const sponsorSlots = [
  { id: 'slot-start', placement: 'home_banner', sponsorId: 'sp-windmuehle', text: 'Beispielbanner: Hier steht die Botschaft eines Hauptsponsors.', active: true },
  { id: 'slot-tag-2', placement: 'day_banner', sponsorId: 'sp-netzfluss', dayId: 'tag-2', text: 'Der zweite Veranstaltungstag wird unterstützt von Netzfluss GmbH.', active: true },
  { id: 'slot-forum-03', placement: 'forum_presented_by', sponsorId: 'sp-netzfluss', forumId: 'forum-03', active: true },
  { id: 'slot-forum-07', placement: 'forum_presented_by', sponsorId: 'sp-turmwerk', forumId: 'forum-07', active: true },
  { id: 'slot-forum-13', placement: 'forum_presented_by', sponsorId: 'sp-kapitalwind', forumId: 'forum-13', active: true },
  { id: 'slot-forum-24', placement: 'forum_presented_by', sponsorId: 'sp-turmwerk', forumId: 'forum-24', active: true },
  { id: 'slot-forum-31', placement: 'forum_presented_by', sponsorId: 'sp-windmuehle', forumId: 'forum-31', active: true },
  { id: 'slot-kalender', placement: 'calendar_note', sponsorId: 'sp-windmuehle', text: 'Programm-App unterstützt von Windmühle Beispiel AG (Anzeige)', active: true },
];

function logoSvg(name, color) {
  const short = name.split(' ')[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60" role="img" aria-label="${name}"><rect width="240" height="60" rx="8" fill="${color}"/><circle cx="30" cy="30" r="14" fill="none" stroke="#fff" stroke-width="3"/><path d="M30 16v28M16 30h28" stroke="#fff" stroke-width="3"/><text x="56" y="38" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#fff">${short}</text></svg>\n`;
}

// ---------- Zusammensetzen ----------
const data = {
  $schema: '../../../schema/event.schema.json',
  schemaVersion: '1.0',
  event: {
    id: EVENT_ID,
    name: 'Demo-Energietage 2027',
    shortName: 'Demo-Energietage',
    description: 'Erfundene Beispielveranstaltung zur Vorführung. Alle Namen von Personen, Firmen und Organisationen sind frei erfunden.',
    timezone: 'Europe/Berlin',
    startDate: DAYS[0].date,
    endDate: DAYS[DAYS.length - 1].date,
    isDemo: true,
    location: { venue: 'Kongresszentrum Musterstadt', street: 'Beispielallee 1', postalCode: '00000', city: 'Musterstadt', country: 'DE' },
    programStatus: { date: STAND, version: VERSION, source: 'tools/generate_demo.mjs (erfundene Daten)' },
  },
  days: DAYS,
  rooms: ROOMS,
  topics: TOPICS,
  organizers: ORGANIZERS,
  speakers,
  forums,
  sessions,
  sponsors,
  sponsorSlots,
};

mkdirSync(resolve(outDir, 'versionen'), { recursive: true });
mkdirSync(resolve(outDir, 'sponsoren'), { recursive: true });
const json = JSON.stringify(data, null, 2) + '\n';
writeFileSync(resolve(outDir, 'versionen', `${VERSION}.json`), json);
writeFileSync(resolve(outDir, 'aktuell.json'), json.replace('"../../../schema/', '"../../schema/'));
for (const s of SPONSORS) writeFileSync(resolve(outDir, 'sponsoren', `${s.id}.svg`), logoSvg(s.name, s.color));

console.log(`Beispielveranstaltung erzeugt: ${forums.length} Foren (davon ${forums.filter((f) => f.kind === 'forum').length} Fachforen), ${sessions.length} Programmpunkte, ${speakers.length} Personen.`);
console.log(`Dateien: data/events/${EVENT_ID}/aktuell.json und versionen/${VERSION}.json`);
