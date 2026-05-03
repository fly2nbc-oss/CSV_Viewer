# 📊 CSV Viewer

> **Schlanker Desktop-CSV-Viewer mit großen Dateien, Suche und Excel-Export – lokal, schnell, plattformübergreifend.**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
![Tauri](https://img.shields.io/badge/Tauri-v2-262626?logo=tauri)
![Rust](https://img.shields.io/badge/Rust-stable-orange?logo=rust&logoColor=white)

**CSV Viewer** öffnet CSV- und Textdateien mit Trennzeichen-Erkennung, zeigt sie in einer virtualisierten Tabelle (auch bei sehr vielen Zeilen flüssig) und erlaubt Export nach **XLSX**. Die Verarbeitung erfolgt vollständig **lokal**; es gibt keinen Server und keine Cloud-Anbindung. Entwickelt mit **Tauri v2** (Rust + statisches Web-Frontend) für geringen Overhead und native Desktop-Integration.

---

## ✨ Features

- **Dateien öffnen:** CSV und TXT per Dialog oder **Drag & Drop** auf das Fenster.
- **Intelligente Trennzeichen:** Erkennung gängiger Delimiter (Komma, Semikolon, Tab usw.) beim Einlesen im Backend.
- **Große Datenmengen:** **Virtualisierte** Tabellenansicht – nur sichtbare Zeilen werden ins DOM gerendert.
- **Suche & Filter:** Volltext über alle Spalten; **numerische Filter** mit Spaltenname und Operatoren (`>`, `<`, `>=`, `<=`, `=`).
- **Spaltenkopf:** **Einfachklick** zeigt für **numerische** Spalten **Summe, Min, Max, Mittelwert** und Stichprobenumfang **n** (bezogen auf die **aktuell gefilterten** Zeilen). **Doppelklick** fügt den Spaltennamen in das Suchfeld ein.
- **Navigation:** Direkter **Sprung** zu einer Zeilennummer.
- **Export:** Speichern der aktuellen Ansicht als **Excel (.xlsx)**.
- **Zwischenablage:** Tabelle in die Zwischenablage kopieren (z. B. für schnelles Einfügen woanders).
- **Darstellung:** **Hell- und Dunkelmodus**, **About**-Dialog im App-Stil (kein natives OS-Modal).
- **Statusleiste:** Zeilen-/Spaltenzahl, sichtbarer Zeilenbereich, Delimiter, Dateipfad.

---

## 📂 Unterstützte Formate

| Kategorie   | Formate / Hinweise                                      |
| ----------- | ------------------------------------------------------- |
| **Import**  | CSV, TXT (mit erkanntem Trennzeichen)                   |
| **Export**  | XLSX (Microsoft Excel-kompatibel)                       |

---

## 🚀 Installation

### Windows

Unter [Releases](https://github.com/fly2nbc-oss/CSV_Viewer/releases) (nach einem Versions-Tag `v*`) stehen u. a. **NSIS-Setup** (`.exe`), **MSI** und optional die portable Datei **`csv-viewer.exe`**. Alternativ: siehe **Entwicklung & Build** und `npm run tauri build`.

### Linux (Debian, Ubuntu, Linux Mint, …)

- **.deb** aus dem [Release](https://github.com/fly2nbc-oss/CSV_Viewer/releases) installieren, z. B.:

  ```bash
  sudo apt install ./CSV\ Viewer_*_amd64.deb
  ```

- Optional: **AppImage** (`CSV Viewer_<Version>_amd64.AppImage`) oder portable **`csv-viewer`**, falls als Asset vorhanden (je nach erfolgreichem Build).
- Voraussetzungen entsprechen den üblichen [Tauri-Linux-Abhängigkeiten](https://v2.tauri.app/start/prerequisites/) (u. a. WebKit-GTK); für `.deb`-Pakete sind Abhängigkeiten in der Regel deklariert.

### Arch Linux / Manjaro (pacman)

Es gibt **kein** von GitHub Actions vorgefertigtes **`.pkg.tar.zst`** mehr im Release-Workflow. Du kannst das Paket **lokal** aus dem Repository bauen:

1. [Build-Paket für pacman](https://wiki.archlinux.org/title/PKGBUILD): z. B. auf Manjaro `sudo pacman -S --needed base-devel git`.
2. Ordner [`packaging/manjaro/`](packaging/manjaro/) verwenden (Repository klonen oder nur diesen Ordner kopieren).
3. **`pkgver`** im `PKGBUILD` muss zu einem existierenden Tag `v1.0.0` passen (siehe `version` in [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json)).
4. Bauen und installieren:

   ```bash
   cd packaging/manjaro
   makepkg -si
   ```

   Das installierte Kommando heißt **`csv-viewer`**.

### macOS

**.dmg** über [Releases](https://github.com/fly2nbc-oss/CSV_Viewer/releases), wenn der Release-Workflow gebaut hat.

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

   Unter Linux erzeugt `tauri build` je nach Konfiguration mehrere Bundle-Typen; **AppImage** kann bei fehlender oder problematischer **linuxdeploy**-Toolchain fehlschlagen. Für ein **zuverlässiges `.deb`**:

   ```bash
   npm run tauri build -- --bundles deb
   ```

Generierte Verzeichnisse wie `node_modules` und `src-tauri/target` können bei Bedarf gelöscht und durch erneutes `npm install` bzw. Build wiederhergestellt werden.

### Release-Binaries und GitHub Actions

- **Releases (Versionstag `v*`):** Unter [Releases](https://github.com/fly2nbc-oss/CSV_Viewer/releases) liegen die gebauten Assets **einzeln** (ohne zusätzliches ZIP pro Datei), z. B. **`.deb`**, **AppImage** (falls Build durchlief), **Windows Setup / MSI**, **macOS `.dmg`**, sowie optional die portablen **`csv-viewer`** / **`csv-viewer.exe`**.
- **Actions (CI):** Workflow-Artefakte werden von GitHub **als ZIP** angeboten. Für direkte Dateilinks die **Release-Assets** nutzen.

**Binärgröße:** Im [Release-Profil](src-tauri/Cargo.toml) ist `opt-level = "z"` (kleinere Rust-Binary) sowie `lto`, `strip` und `panic = "abort"` gesetzt; der Großteil der App-Größe entfällt weiterhin auf **WebView2** bzw. **WebKit-GTK**.

---

## 🏗 Projektstruktur

- **`web/`** – Frontend: Plain **HTML**, **CSS**, **JavaScript** (ohne separaten Vite/React-Build; Tauri lädt `frontendDist` direkt).
- **`src-tauri/`** – Rust-Backend, Tauri-Konfiguration, Icons.
  - **`lib.rs`** – Tauri-Setup, Kommandos wie `read_csv`, `export_xlsx`, Drag-and-Drop-Event `csv-dropped`.
  - **`main.rs`** – nativer Einstiegspunkt.
- **`packaging/manjaro/`** – **PKGBUILD** und Hilfsdateien zum **lokalen** Bau eines **pacman**-Pakets (nicht mehr Teil der GitHub-Release-Pipeline).

Ausführliche technische Beschreibung: siehe **`CSV_Viewer_Doc.md`** im Repository.

---

## 📄 Lizenz

Lizenziert unter der **Apache License, Version 2.0**. Den vollständigen Text findest du in der Datei [`LICENSE`](LICENSE).

---

## 🔗 Repository

<https://github.com/fly2nbc-oss/CSV_Viewer>
