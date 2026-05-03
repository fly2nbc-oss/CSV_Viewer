# 📊 CSV Viewer

> **Schlanker Desktop-CSV-Viewer mit großen Dateien, Suche und Excel-Export – lokal, schnell, plattformübergreifend.**

![Tauri](https://img.shields.io/badge/Tauri-v2-262626?logo=tauri)
![Rust](https://img.shields.io/badge/Rust-stable-orange?logo=rust&logoColor=white)

**CSV Viewer** öffnet CSV- und Textdateien mit Trennzeichen-Erkennung, zeigt sie in einer virtualisierten Tabelle (auch bei sehr vielen Zeilen flüssig) und erlaubt Export nach **XLSX**. Die Verarbeitung erfolgt vollständig **lokal**; es gibt keinen Server und keine Cloud-Anbindung. Entwickelt mit **Tauri v2** (Rust + statisches Web-Frontend) für geringen Overhead und native Desktop-Integration.

---

## ✨ Features

- **Dateien öffnen:** CSV und TXT per Dialog oder **Drag & Drop** auf das Fenster.
- **Intelligente Trennzeichen:** Erkennung gängiger Delimiter (Komma, Semikolon, Tab usw.) beim Einlesen im Backend.
- **Große Datenmengen:** **Virtualisierte** Tabellenansicht – nur sichtbare Zeilen werden ins DOM gerendert.
- **Suche & Navigation:** Filter über alle Spalten; **direkter Sprung** zu einer Zeilennummer.
- **Export:** Speichern der aktuellen Ansicht als **Excel (.xlsx)**.
- **Zwischenablage:** Tabelle in die Zwischenablage kopieren (z. B. für schnelles Einfügen woanders).
- **Statusleiste:** Anzeige von Bereich, Zeilen-/Spaltenzahl, erkanntem Delimiter und Dateipfad.

---

## 📂 Unterstützte Formate

| Kategorie   | Formate / Hinweise                                      |
| ----------- | ------------------------------------------------------- |
| **Import**  | CSV, TXT (mit erkanntem Trennzeichen)                   |
| **Export**  | XLSX (Microsoft Excel-kompatibel)                       |

---

## 🚀 Installation

### Windows

Sobald Releases veröffentlicht sind, findest du dort Installer bzw. portable Builds (analog zu anderen Projekten unter [fly2nbc-oss](https://github.com/fly2nbc-oss)). Bis dahin: siehe **Entwicklung & Build** und `npm run tauri build`.

### Linux

Installierbare Pakete (z. B. **AppImage**, **.deb**) können ebenfalls über **GitHub Releases** bereitgestellt werden. Für lokales Bauen gelten die üblichen [Tauri-Voraussetzungen für Linux](https://v2.tauri.app/start/prerequisites/) (u. a. WebKit-GTK).

---

## 🛠 Entwicklung & Build

Voraussetzungen: **Node.js** (empfohlen aktuelle LTS oder neuer), **Rust (stable)** und die [Tauri-Prerequisites](https://v2.tauri.app/start/prerequisites/) für dein Betriebssystem.

1. **Repository klonen:**

   ```bash
   git clone https://github.com/fly2nbc-oss/CSV_Viewer.git
   cd CSV_Viewer
   ```

2. **Abhängigkeiten installieren:**

   ```bash
   npm install
   ```

3. **Entwicklungsmodus:**

   ```bash
   npm run tauri dev
   ```

4. **Produktions-Build:**

   ```bash
   npm run tauri build
   ```

Generierte Verzeichnisse wie `node_modules` und `src-tauri/target` können bei Bedarf gelöscht und durch erneutes `npm install` bzw. Build wiederhergestellt werden.

---

## 🏗 Projektstruktur

- **`web/`** – Frontend: Plain **HTML**, **CSS**, **JavaScript** (ohne separaten Vite/React-Build; Tauri lädt `frontendDist` direkt).
- **`src-tauri/`** – Rust-Backend, Tauri-Konfiguration, Icons.
  - **`lib.rs`** – Tauri-Setup, Kommandos wie `read_csv`, `export_xlsx`, Drag-and-Drop-Event `csv-dropped`.
  - **`main.rs`** – nativer Einstiegspunkt.

Ausführliche technische Beschreibung: siehe **`CSV_Viewer_Doc.md`** im Repository.

---

## 🔗 Repository

<https://github.com/fly2nbc-oss/CSV_Viewer>
