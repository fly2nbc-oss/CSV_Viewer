# Tauri-Dokumentation: CSV Viewer

## Zweck der Anwendung

Dieses Projekt ist ein schlanker Desktop-CSV-Viewer auf Basis von Tauri 2. Die Anwendung kombiniert:

- ein statisches Web-Frontend in `web/`
- ein natives Rust-Backend in `src-tauri/`
- Tauri als Bruecke zwischen Benutzeroberflaeche und Desktop-Funktionen

Die Kernaufgabe der Anwendung ist das Oeffnen, Anzeigen, Filtern und Exportieren von CSV- bzw. TXT-Dateien. Die Daten werden lokal gelesen und verarbeitet. Es gibt keinen Server und keine externe Datenhaltung.

## Gesamtstruktur des Projekts

Das Repository wurde auf die aktive Tauri-Anwendung reduziert. Relevante Ordner und Dateien sind:

```text
CSV-Viewer/
|- web/                     # Statisches Frontend
|  |- index.html            # HTML-Grundgeruest der Anwendung
|  |- main.js               # Gesamte Frontend-Logik
|  `- styles.css            # Layout und Tabellen-Styles
|- src-tauri/               # Tauri-/Rust-Anwendung
|  |- src/
|  |  |- main.rs            # Nativer Einstiegspunkt
|  |  `- lib.rs             # Tauri-Setup und Rust-Kommandos
|  |- capabilities/
|  |  `- default.json       # Tauri-Berechtigungen fuer das Hauptfenster
|  |- icons/                # Anwendungsicons fuer Bundles
|  |- Cargo.toml            # Rust-Abhaengigkeiten und Buildprofil
|  |- build.rs              # Tauri-Buildintegration
|  `- tauri.conf.json       # Hauptkonfiguration der Tauri-App
|- package.json             # Node-/Tauri-CLI-Abhaengigkeiten
|- package-lock.json        # Aufgeloeste Node-Abhaengigkeiten
`- README.md                # Kurze Projektbeschreibung
```

## Architekturbild

Die Anwendung folgt einem einfachen Zweischichtenmodell:

1. Das Frontend in `web/` rendert die Oberflaeche, verarbeitet Benutzereingaben und zeigt CSV-Daten an.
2. Das Rust-Backend liest Dateien, erkennt das Trennzeichen, decodiert Text und exportiert XLSX-Dateien.

Die Kommunikation erfolgt ueber Tauri-Commands:

- `read_csv`
- `startup_csv_path`
- `export_xlsx`

Zusatzlich sendet das Rust-Backend bei nativen Drag-and-Drop-Ereignissen ein Tauri-Event:

- `csv-dropped`

## Start- und Laufzeitverhalten

### 1. Start der nativen Anwendung

Der native Einstiegspunkt liegt in `src-tauri/src/main.rs`.

- Die Datei blendet in Release-Builds auf Windows das Konsolenfenster aus.
- Anschliessend wird `csv_viewer_lib::run()` aufgerufen.

Die eigentliche Initialisierung befindet sich in `src-tauri/src/lib.rs`.

### 2. Aufbau des Tauri-Builders

In `run()` wird der Tauri-Builder konfiguriert:

- Initialisierung des Dialog-Plugins
- Registrierung eines Window-Event-Handlers fuer Drag and Drop
- Registrierung der drei Rust-Kommandos fuer das Frontend
- Start der Anwendung mit `tauri::generate_context!()`

Damit ist das Rust-Backend bewusst klein gehalten: Es uebernimmt nur Desktop-nahe Aufgaben und Dateiverarbeitung.

### 3. Laden des Frontends

In `src-tauri/tauri.conf.json` ist `frontendDist` auf `../web` gesetzt. Das bedeutet:

- Es gibt keinen separaten Frontend-Build mit Vite, React oder aehnlichen Frameworks.
- Tauri laedt die statischen Dateien direkt aus dem Ordner `web/`.
- Die Anwendung verwendet Plain HTML, Plain CSS und Plain JavaScript.

## Tauri-Konfiguration im Detail

Die zentrale Konfigurationsdatei ist `src-tauri/tauri.conf.json`.

### Wichtige Einstellungen

- `productName`: sichtbarer Produktname `CSV Viewer`
- `version`: aktuell `1.0.0`
- `identifier`: `com.hms.csvviewer`
- `withGlobalTauri: true`: Tauri-APIs stehen im Frontend global unter `window.__TAURI__` zur Verfuegung
- Fenstergroesse: `1200 x 800`
- `resizable: true`: Fenster ist skalierbar
- `dragDropEnabled: true`: native Drag-and-Drop-Unterstuetzung ist aktiviert
- `bundle.active: true`: die Anwendung ist fuer Packaging/Bundling vorbereitet

### Sicherheitsmodell

Die Security-Section verweist auf die Capability `main-capability`.

In `src-tauri/capabilities/default.json` sind aktuell freigegeben:

- `core:default`
- `dialog:default`

Das ist konsistent mit dem aktuellen Funktionsumfang:

- Das Frontend darf Tauri-Core-Commands aufrufen.
- Das Frontend darf Datei-Dialoge oeffnen und Speicherpfade auswaehlen.

Eine Dateisystem-Capability ist hier nicht explizit freigeschaltet, weil das eigentliche Lesen und Schreiben in Rust ueber die eigenen Commands erfolgt.

## Frontend-Struktur

### `web/index.html`

Die HTML-Datei definiert die komplette sichtbare Grundstruktur.

### Toolbar-Elemente

Die Toolbar enthaelt:

- `Open CSV`: Dateiauswahl zum Laden einer CSV/TXT-Datei
- `Export XLSX`: Export der geladenen Daten nach Excel
- `Copy Table`: Kopiert die aktuell sichtbare Tabelle in die Zwischenablage
- Suchfeld: Filtert ueber alle Spalten
- Zahlenfeld `Row #`: Sprung zu einer bestimmten Zeile
- `Go`: loest den Zeilensprung aus
- Statusanzeigen fuer:
  - sichtbaren Bereich
  - Zeilenanzahl
  - Spaltenanzahl
  - erkannten Delimiter
  - Dateipfad bzw. Statusmeldung

### Tabellenbereich

`<section id="tableWrap">` ist der zentrale Scroll-Container. Hier wird:

- entweder ein leerer Hinweistext angezeigt
- oder die virtualisierte Tabelle dynamisch per JavaScript erzeugt

### `web/styles.css`

Die CSS-Datei setzt eine funktionale, kompakte Desktop-Oberflaeche um.

### Wichtige Layout-Eigenschaften

- Vollflaechige App mit `100vw` und `100vh`
- Toolbar als flexibles Wrap-Layout
- Scrollbarer Tabellenbereich
- Sticky-Header fuer die Tabellenspalten
- Hover-Highlight fuer Tabellenzeilen
- optische Markierung bei Drag and Drop

### Tabellenlayout

Die Tabelle ist keine native `<table>`, sondern eine Grid-basierte Darstellung:

- Kopf- und Datenzeilen verwenden CSS Grid
- Spaltenbreiten werden dynamisch aus JavaScript gesetzt
- die Gesamtbreite der Tabelle wird ueber CSS-Variablen gesteuert

Das passt zur Virtualisierung, weil einzelne Zeilen absolut positioniert werden.

## Frontend-Logik in `web/main.js`

Die komplette Client-Logik liegt in einer einzigen Datei. Sie enthaelt Statusverwaltung, Rendering, Filterung, Drag and Drop, Clipboard-Handling und die Tauri-Aufrufe.

### 1. Konfiguration und Initialzustand

Zu Beginn werden Konstanten definiert, unter anderem fuer:

- Leermeldungen
- Overscan bei der Virtualisierung
- Standardhoehen fuer Kopf und Datenzeilen
- minimale und maximale Spaltenbreite
- Anzahl der Stichprobenzeilen fuer Breitenmessung

Danach folgen:

- `ui`: Sammlung aller relevanten DOM-Referenzen
- `state`: zentraler Frontend-Zustand

Der Zustand speichert:

- geladenen Dateipfad
- Header
- alle CSV-Zeilen
- gefilterte Zeilen
- erkannten Delimiter
- aktuelle Suchanfrage
- aktuelle Metriken fuer Zeilenhoehe, Headerhoehe und Spaltenbreiten

### 2. Hilfsfunktionen

Mehrere kleine Helfer kapseln Standardaufgaben:

- `escapeHtml`: verhindert HTML-Injection bei Zellinhalten
- `displayDelimiter`: formatiert Delimiter fuer die Anzeige
- `clamp`: begrenzt Werte auf Min/Max
- `sampleRows`: waehlt fuer Breitenmessungen nur eine Teilmenge grosser Datenmengen aus
- `setInfo`: schreibt Statusmeldungen in die Toolbar
- `run`: einheitlicher Fehlerrahmen fuer asynchrone Aktionen

### 3. Spaltenbestimmung und Breitenmessung

Die Tabelle passt Spaltenbreiten automatisch an.

#### `getColumns()`

- Verwendet die Header-Zeile, wenn vorhanden.
- Falls Header fehlen, werden Platzhalternamen wie `Column 1`, `Column 2` erzeugt.

#### `measureTextWidth()` und `refreshColumnMetrics()`

- Textbreiten werden ueber ein unsichtbares Canvas gemessen.
- Zuerst werden die Header vermessen.
- Danach werden Stichproben aus den Datenzeilen geprueft.
- Jede Spalte erhaelt eine Breite innerhalb definierter Min-/Max-Grenzen.

Das ist wichtig, damit auch grosse Dateien performant darstellbar bleiben, ohne jede einzelne Zelle vorher durchzurechnen.

### 4. Virtuelles Rendering der Tabelle

Ein zentrales Merkmal der Anwendung ist die Tabellen-Virtualisierung.

#### Ziel

Bei sehr vielen Zeilen soll nicht die komplette Tabelle gleichzeitig im DOM liegen. Stattdessen werden nur die aktuell sichtbaren und einige zusaetzliche Zeilen gerendert.

#### Wichtige Funktionen

##### `currentViewportRange()`

Berechnet:

- erste zu rendernde Zeile
- letzte zu rendernde Zeile
- gesamte virtuelle Tabellenhoehe
- aktuell sichtbaren Anzeigeausschnitt fuer die Toolbar

Dabei wird ein `OVERSCAN_ROWS`-Puffer verwendet, um Scrollen fluessiger zu machen.

##### `renderTable()`

Erzeugt das aktuelle HTML fuer:

- Tabellenkopf
- virtuellen Body
- sichtbare Teilmenge der Datenzeilen

Die Datenzeilen werden absolut positioniert und ueber `transform: translateY(...)` an ihre virtuelle Position verschoben.

##### `syncVirtualMeasurements()`

Nach einem Renderdurchlauf werden reale Hoehen von Header und Datenzeilen gemessen. Falls sich diese von den Annahmen unterscheiden, wird ein neues Rendering angestossen.

##### `queueRender()`

Verhindert unnoetige Mehrfach-Renderings, indem Updates per `requestAnimationFrame` gebuendelt werden.

### 5. Laden einer CSV-Datei

#### `loadCsvFromPath(path)`

Diese Funktion ist das zentrale Bindeglied zwischen Frontend und Rust.

Ablauf:

1. Aufruf des Tauri-Commands `read_csv`
2. Uebernahme der Rueckgabedaten in den Frontend-Zustand
3. Zuruecksetzen von Suche, Scrollposition und Tabellenmetriken
4. Sofortiges Re-Rendering der Tabelle

Die Rueckgabe aus Rust enthaelt:

- `headers`
- `rows`
- `delimiter`

### 6. Datei oeffnen

#### `openCsv()`

- Oeffnet ueber das Dialog-Plugin einen Dateiauswahldialog.
- Erlaubt `.csv` und `.txt`.
- Bei erfolgreicher Auswahl wird `loadCsvFromPath()` aufgerufen.

### 7. XLSX-Export

#### `exportXlsx()`

- Oeffnet einen Save-Dialog.
- Schlaegt standardmaessig den gleichen Dateinamen wie die CSV mit Endung `.xlsx` vor.
- Ruft anschliessend den Rust-Command `export_xlsx` auf.
- Uebergibt Header, komplette Datenzeilen, Ausgabepfad und den Blattnamen `CSV Export`.

Wichtig: Exportiert werden immer die kompletten geladenen Daten, nicht nur die aktuell sichtbaren Zeilen im Scrollbereich.

### 8. Suche und Filterung

#### `applyFilter()`

- Die Suche arbeitet case-insensitive.
- Es wird ueber alle Spalten einer Zeile gesucht.
- Eine Zeile bleibt sichtbar, wenn mindestens eine Zelle den Suchbegriff enthaelt.

Die gefilterte Datenmenge wird in `state.filteredRows` gehalten. Darauf arbeiten dann:

- Rendering
- Zeilenzaehler
- Clipboard-Kopie
- Sprunglogik

### 9. Kopieren in die Zwischenablage

#### `buildClipboardText()`

- Erstellt TSV-aehnlichen Text mit Tab als Spaltentrenner
- Fuegt die Spaltenkoepfe als erste Zeile ein
- Normalisiert Zeilenumbrueche und Tabs innerhalb von Zellen

#### `writeClipboard(text)`

- Verwendet bevorzugt `navigator.clipboard.writeText`
- faellt bei Bedarf auf ein unsichtbares `textarea` plus `document.execCommand("copy")` zurueck

#### `copyCurrentTable()`

- Kopiert die aktuell sichtbare gefilterte Tabelle
- nicht nur die sichtbaren Scroll-Zeilen, sondern alle Zeilen des aktuellen Filters

Zusaetzlich existiert ein globaler Shortcut:

- `Ctrl+C` bzw. `Cmd+C`

Der Shortcut greift nur dann, wenn:

- keine Eingabe fokussiert ist
- keine Textselektion aktiv ist
- es sichtbare Tabellenzeilen gibt

### 10. Zeilensprung

#### `jumpToRow()`

- Liest die eingegebene Zielzeile aus dem Number-Input
- prueft, ob die Zeile innerhalb des aktuellen Filters existiert
- scrollt den Tabellencontainer zur berechneten Position

Der Zeilensprung bezieht sich auf `visibleRows()`, also auf die gefilterte Ansicht.

### 11. Drag and Drop

Die Anwendung unterstuetzt zwei Arten von Drag and Drop:

#### Browserseitiges Drop-Handling

Im Frontend werden `dragover`, `dragleave` und `drop` auf `window` behandelt.

Dabei:

- wird das Standardverhalten verhindert
- die Drop-Zone visuell hervorgehoben
- der Dateipfad aus `event.dataTransfer.files[0].path` gelesen

#### Natives Tauri-Drop-Handling

Im Rust-Backend lauscht `on_window_event(...)` auf `WindowEvent::DragDrop`.

Beim Ablegen einer Datei:

- wird der erste Pfad aus dem Event gelesen
- als String umgewandelt
- per `window.emit("csv-dropped", value)` an das Frontend gesendet

Im Frontend registriert `setupDragAndDrop()` einen Listener fuer dieses Event und ruft dann ebenfalls `handleDropPath()` auf.

Damit ist Drag and Drop sowohl ueber DOM-Ereignisse als auch ueber den nativen Tauri-Weg abgesichert.

### 12. Start mit Dateipfad als Argument

#### `loadStartupPath()`

Beim Start der Anwendung ruft das Frontend den Command `startup_csv_path` auf.

Damit kann die App direkt mit einer Datei geoeffnet werden, wenn beim Start ein gueltiger Pfad als erstes Kommandozeilenargument uebergeben wurde.

Anwendungsfall:

- Doppelklick-Zuordnung einer `.csv`-Datei zur App
- Start ueber Shell mit Dateipfad

## Rust-Backend in `src-tauri/src/lib.rs`

Das Backend enthaelt alle nativen Operationen. Die Datei ist funktional in Datenstrukturen, Hilfsfunktionen, Commands und App-Setup gegliedert.

### Datenstrukturen

#### `CsvData`

Rueckgabeobjekt fuer `read_csv`.

Enthaelt:

- `headers: Vec<String>`
- `rows: Vec<Vec<String>>`
- `delimiter: char`

#### `ExportRequest`

Eingabeobjekt fuer `export_xlsx`.

Enthaelt:

- Header
- Zeilen
- Zielpfad
- optionalen Arbeitsblattnamen

### Hilfsfunktion: Textdecodierung

#### `decode_text(bytes: &[u8]) -> String`

Diese Funktion erkennt mehrere gaengige Textkodierungen:

- UTF-8 mit BOM
- UTF-16 LE mit BOM
- UTF-16 BE mit BOM
- UTF-8 ohne BOM
- Fallback auf Windows-1252

Das ist fuer CSV-Dateien wichtig, weil sie in Windows-Umgebungen oft nicht sauber als UTF-8 gespeichert sind.

### Hilfsfunktion: Trennzeichenerkennung

#### `detect_delimiter(sample: &str) -> u8`

Die Anwendung prueft die ersten 20 Zeilen und zaehlt das Vorkommen dieser Kandidaten:

- Komma `,`
- Semikolon `;`
- Tab
- Pipe `|`

Das Zeichen mit den meisten Treffern wird als Delimiter verwendet.

#### `extract_separator_hint(text: &str) -> Option<(u8, &str)>`

Einige CSV-Dateien, speziell aus Excel/Windows-Kontexten, beginnen mit einer Zeile wie:

```text
sep=;
```

Wenn diese Hint-Zeile vorhanden ist:

- wird das Trennzeichen direkt uebernommen
- die erste Zeile wird aus dem eigentlichen CSV-Inhalt entfernt

Das verbessert die Kompatibilitaet mit exportierten CSV-Dateien aus Office-Werkzeugen.

### Hilfsfunktion: Zeilennormalisierung

#### `normalize_row(record, expected_len)`

- Wandelt ein CSV-Record in `Vec<String>` um
- fuellt fehlende Zellen mit leeren Strings auf

Das ist notwendig, weil der CSV-Reader mit `flexible(true)` arbeitet und somit unterschiedlich lange Zeilen akzeptiert.

## Tauri-Commands

### `read_csv(path: String) -> Result<CsvData, String>`

Funktion:

- liest die Datei als Bytefolge
- decodiert den Text
- bestimmt das Trennzeichen
- initialisiert den CSV-Reader
- liest Header und Datensaetze
- normalisiert Zeilenlaengen
- liefert alle Daten an das Frontend zurueck

Wichtige Eigenschaften:

- `has_headers(true)`: die erste CSV-Zeile wird als Header interpretiert
- `flexible(true)`: unterschiedlich lange Zeilen sind erlaubt

### `startup_csv_path() -> Option<String>`

Funktion:

- liest das erste Kommandozeilenargument
- akzeptiert nur vorhandene Dateien mit Endung `.csv` oder `.txt`
- liefert den Pfad fuer den automatischen Startimport an das Frontend

### `export_xlsx(payload: ExportRequest) -> Result<(), String>`

Funktion:

- erzeugt eine neue Excel-Arbeitsmappe
- benennt das Standardblatt optional um
- schreibt Header in Zeile 1
- schreibt Datenzeilen ab Zeile 2
- legt Zielordner bei Bedarf an
- speichert die Datei als `.xlsx`

Die Implementation verwendet `umya-spreadsheet`.

## Abhaengigkeiten und ihre Rollen

### JavaScript-/Node-Seite

`package.json` enthaelt:

- `@tauri-apps/cli`: Starten und Bauen der App
- `@tauri-apps/api`: Zugriff auf Tauri-Core-APIs im Frontend
- `@tauri-apps/plugin-dialog`: Open-/Save-Dialoge

### Rust-Seite

`src-tauri/Cargo.toml` enthaelt:

- `tauri`: Kernframework
- `tauri-plugin-dialog`: Dialog-Plugin
- `serde`, `serde_json`: Datenaustausch zwischen Frontend und Backend
- `csv`: CSV-Parsing
- `umya-spreadsheet`: XLSX-Erzeugung
- `encoding_rs`: Zeichensatzdecodierung

## Datenfluss in der Anwendung

Ein typischer Ablauf beim Oeffnen einer Datei sieht so aus:

1. Benutzer klickt auf `Open CSV` oder zieht eine Datei ins Fenster.
2. Das Frontend ermittelt einen Dateipfad.
3. Das Frontend ruft `read_csv` im Rust-Backend auf.
4. Rust liest und parst die Datei.
5. Rust liefert Header, Zeilen und Delimiter an das Frontend.
6. Das Frontend speichert die Daten im zentralen `state`.
7. Die Tabelle wird virtuell gerendert.
8. Suche, Kopieren und Zeilensprung arbeiten nur noch auf den bereits geladenen Daten im Frontend.
9. Beim Export werden die kompletten Daten wieder an Rust uebergeben.
10. Rust schreibt daraus eine XLSX-Datei auf das Dateisystem.

## Build- und Packaging-Struktur

### `package.json`

Stellt das Tauri-CLI-Skript bereit:

```bash
npm.cmd run tauri dev
npm.cmd run tauri build
```

### `src-tauri/build.rs`

Die Build-Datei besteht nur aus:

```rust
fn main() {
    tauri_build::build()
}
```

Das ist der Standardweg, um Tauri-Build-Metadaten und Integration fuer das Packaging bereitzustellen.

### Release-Profil in `Cargo.toml`

Das Projekt ist fuer kleine Release-Binaries optimiert:

- `opt-level = "s"`
- `lto = true`
- `codegen-units = 1`
- `strip = true`
- `panic = "abort"`

## Aktueller Funktionsumfang aus Benutzersicht

Die Tauri-Anwendung bietet aktuell:

- Oeffnen von `.csv`- und `.txt`-Dateien
- Drag and Drop von Dateien in das Fenster
- automatisches Erkennen gaengiger Delimiter
- Unterstuetzung mehrerer Textkodierungen
- Anzeige grosser Tabellen per Virtualisierung
- Suchfilter ueber alle Spalten
- Sprung zu einer bestimmten Zeile
- Kopieren der aktuellen gefilterten Tabelle in die Zwischenablage
- Export der geladenen Daten nach XLSX
- automatisches Laden einer Datei beim App-Start per Argument

## Auffaellige technische Entscheidungen

### 1. Kein Frontend-Framework

Die Anwendung verwendet absichtlich kein React, Vue oder Svelte. Das reduziert Build-Komplexitaet und Abhaengigkeiten, bedeutet aber auch:

- mehr manuelle DOM-Logik
- eine zentrale, groessere `main.js`

### 2. State komplett im Frontend

Nach dem Laden liegen alle CSV-Daten im Browser-Kontext des Tauri-Fensters. Dadurch sind Suche und Rendering lokal sehr direkt, allerdings wird die komplette Datei in den Speicher uebernommen.

### 3. Export auf Basis bereits geladener Daten

Der XLSX-Export liest die CSV-Datei nicht erneut von der Festplatte, sondern verwendet die bereits im Frontend gehaltenen Daten.

### 4. Virtualisierung statt klassischer HTML-Tabelle

Die Darstellung ist bewusst auf Performance fuer viele Zeilen ausgelegt. Deshalb wird:

- nur ein Ausschnitt der Daten gerendert
- die Gesamthoehe virtuell simuliert
- horizontal ueber CSS Grid gearbeitet

## Grenzen und moegliche Erweiterungen

Aus dem aktuellen Code ergeben sich auch erkennbare Grenzen:

- Es gibt keine Sortierfunktion fuer Spalten.
- Es gibt keine Bearbeitung einzelner Zellen.
- Es gibt keine Seitennavigation im klassischen Sinn; stattdessen wird virtualisiert gescrollt.
- Es gibt keine Streaming-Verarbeitung fuer extrem grosse Dateien; alles wird in den Speicher geladen.
- Es gibt keine explizite Validierung des Dateiinhalts ueber die Dateiendung hinaus.

## Kurzfazit

Der Tauri-Teil des Projekts ist bewusst kompakt aufgebaut:

- `web/` liefert eine einfache, performante Desktop-Oberflaeche ohne Framework
- `src-tauri/` uebernimmt Dateiverarbeitung, Desktop-Integration und Export
- Tauri verbindet beide Teile ueber Commands und Events

Funktional ist die Anwendung bereits auf einen klaren Arbeitsablauf zugeschnitten: CSV laden, schnell durchsuchen, grossen Datenbestand performant anzeigen und bei Bedarf als XLSX exportieren.
