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

Unter [Releases](https://github.com/fly2nbc-oss/CSV_Viewer/releases) liegen nach einem Versionstag (`v*`) Installer (**NSIS**), sofern der Release-Workflow gelaufen ist. Alternativ: siehe **Entwicklung & Build** und `npm run tauri build`.

### Linux (Debian, Ubuntu, Linux Mint, …)

- **.deb** aus dem [Release](https://github.com/fly2nbc-oss/CSV_Viewer/releases) herunterladen und installieren, z. B.:

  ```bash
  sudo apt install ./CSV\ Viewer_*_amd64.deb
  ```

- Voraussetzungen entsprechen den üblichen [Tauri-Linux-Abhängigkeiten](https://v2.tauri.app/start/prerequisites/) (u. a. WebKit-GTK); für `.deb`-Pakete sind Abhängigkeiten in der Regel deklariert.

### Arch Linux / Manjaro (pacman)

**Vorgefertigtes Paket:** Bei [Releases](https://github.com/fly2nbc-oss/CSV_Viewer/releases) (nach Tag `v*`) gibt es eine Datei **`csv-viewer-*-x86_64.pkg.tar.zst`** – direkt ohne ZIP als Release-Asset. Install:

```bash
sudo pacman -U ./csv-viewer-*-x86_64.pkg.tar.zst
```

**Selbst bauen:** Im Repository liegen `packaging/manjaro/PKGBUILD` (Tarball von GitHub) und `PKGBUILD.ci` (für CI/lokale Kopie). Vorgehen wie zuvor:

1. [Build-Paket für pacman](https://wiki.archlinux.org/title/PKGBUILD) installieren, z. B. auf Manjaro:

   ```bash
   sudo pacman -S --needed base-devel git
   ```

2. Ordner `packaging/manjaro/` aus diesem Repository verwenden (z. B. Repository klonen oder nur diesen Ordner kopieren).

3. **Wichtig:** `pkgver` im `PKGBUILD` muss zu einem existierenden Tag `v1.0.0` passen (siehe `version` in `src-tauri/tauri.conf.json`).

4. Paket bauen und installieren:

   ```bash
   cd packaging/manjaro
   makepkg -si
   ```

   `makepkg` lädt den Tarball `v${pkgver}` von GitHub, wird `npm ci` und `tauri build --no-bundle` aus. Das installierte Kommando heißt **`csv-viewer`**.

**Checksum:** Die erste Quelle (`SKIP`) kann nach einem Release mit `updpkgsums` im PKGBUILD-Ordner aktualisiert werden.

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

   Unter Linux erzeugt `tauri build` standardmäßig mehrere Bundle-Typen; **AppImage** kann je nach Toolchain fehlschlagen. Für ein **zuverlässiges `.deb`** (u. a. für CI):

   ```bash
   npm run tauri build -- --bundles deb
   ```

Generierte Verzeichnisse wie `node_modules` und `src-tauri/target` können bei Bedarf gelöscht und durch erneutes `npm install` bzw. Build wiederhergestellt werden.

### Release-Binaries und GitHub Actions

- **Releases (Versionstag `v*`):** Unter [Releases](https://github.com/fly2nbc-oss/CSV_Viewer/releases) liegen **einzelne Dateien** (`.deb`, `.exe`, `.dmg`, `.pkg.tar.zst`) zum direkten Download **ohne ZIP** (jeweils ein Asset = eine Datei).
- **Actions (CI):** Workflow-Artefakte werden von GitHub **weiterhin als ZIP** zum Download angeboten (Plattformlimit). Pro Artefakt liegt darin nur **eine** Installationsdatei (maximale Komprimierung aus, schnelleres Entpacken). Für direkte Links die **Release-Assets** nutzen.

**Binärgröße:** Im [Release-Profil](src-tauri/Cargo.toml) ist `opt-level = "z"` (kleinere Rust-Binary) sowie `lto`, `strip` und `panic = "abort"` gesetzt; der Großteil der App-Größe entfällt weiterhin auf **WebView2** bzw. **WebKit-GTK**.

---

## 🏗 Projektstruktur

- **`web/`** – Frontend: Plain **HTML**, **CSS**, **JavaScript** (ohne separaten Vite/React-Build; Tauri lädt `frontendDist` direkt).
- **`src-tauri/`** – Rust-Backend, Tauri-Konfiguration, Icons.
  - **`lib.rs`** – Tauri-Setup, Kommandos wie `read_csv`, `export_xlsx`, Drag-and-Drop-Event `csv-dropped`.
  - **`main.rs`** – nativer Einstiegspunkt.
- **`packaging/manjaro/`** – **PKGBUILD** (Release-Tarball), **PKGBUILD.ci** (CI/lokale Kopie), Desktop- und Install-Skripte für **Arch Linux / Manjaro**.

Ausführliche technische Beschreibung: siehe **`CSV_Viewer_Doc.md`** im Repository.

---

## 📄 Lizenz

Lizenziert unter der **Apache License, Version 2.0**. Den vollständigen Text findest du in der Datei [`LICENSE`](LICENSE).

---

## 🔗 Repository

<https://github.com/fly2nbc-oss/CSV_Viewer>
