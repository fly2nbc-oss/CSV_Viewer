const EMPTY_TITLE = "No dataset loaded";
const EMPTY_TEXT = "Load a CSV, TXT or XLSX via button or drag and drop.";
const NO_MATCHES_TITLE = "No matching rows";
const NO_MATCHES_TEXT = "No rows match the current search.";
const NO_DATA_TITLE = "File loaded without rows";
const NO_DATA_TEXT = "The file was opened successfully, but it does not contain any data rows.";
const OVERSCAN_ROWS = 8;
const DEFAULT_ROW_HEIGHT = 32;
const DEFAULT_HEADER_HEIGHT = 34;
const MIN_COLUMN_WIDTH = 96;
const MAX_COLUMN_WIDTH = 420;
const COLUMN_SAMPLE_LIMIT = 300;
const CELL_HORIZONTAL_PADDING = 20;
const THEME_KEY = "csv-viewer-theme";
const EMPTY_ICON_SVG = `
  <span class="empty-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4h4M10 9h8M10 13h8M10 17h4" />
    </svg>
  </span>`;
const tauri = window.__TAURI__ ?? {};
const $ = (id) => document.getElementById(id);

const ui = {
  openBtn: $("openBtn"),
  exportBtn: $("exportBtn"),
  copyBtn: $("copyBtn"),
  searchInput: $("searchInput"),
  jumpBtn: $("jumpBtn"),
  rowInput: $("rowInput"),
  fileInfo: $("fileInfo"),
  rowCount: $("rowCount"),
  columnCount: $("columnCount"),
  delimiterInfo: $("delimiterInfo"),
  tableWrap: $("tableWrap"),
  viewInfo: $("viewInfo"),
  sheetSelectorContainer: $("sheetSelectorContainer"),
  sheetSelector: $("sheetSelector"),
  statsBar: $("statsBar"),
  statsName: $("statsName"),
  statsSum: $("statsSum"),
  statsMin: $("statsMin"),
  statsMax: $("statsMax"),
  statsAvg: $("statsAvg"),
  themeToggle: $("themeToggle"),
  aboutBtn: $("aboutBtn"),
  aboutModal: $("aboutModal"),
  aboutOkBtn: $("aboutOkBtn"),
  aboutModalVersion: $("aboutModalVersion"),
};

const state = {
  filePath: "",
  headers: [],
  rows: [],
  filteredRows: [],
  delimiter: "-",
  searchQuery: "",
  rowHeight: DEFAULT_ROW_HEIGHT,
  headerHeight: DEFAULT_HEADER_HEIGHT,
  columnWidths: [],
  totalWidth: 0,
  statsColumnIndex: -1,
  sheets: [],
  currentSheet: "",
};

let sheetSelectProgrammatic = false;

const statsNumberFmt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });

let headerStatsClickTimer = 0;

let renderQueued = false;
let measurementFrame = 0;
let measurementCanvas;

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const visibleRows = () => state.filteredRows;
const hasDataset = () => Boolean(state.filePath) || totalColumns() > 0;
const totalColumns = () =>
  state.headers.length ||
  state.rows.reduce((max, row) => Math.max(max, row.length), 0);

function getColumns() {
  return Array.from(
    { length: totalColumns() },
    (_, index) => state.headers[index] ?? `Column ${index + 1}`
  );
}

function isXlsxPath(path) {
  return typeof path === "string" && /\.xlsx$/i.test(path);
}

function updateSheetSelector() {
  const wrap = ui.sheetSelectorContainer;
  const sel = ui.sheetSelector;
  if (!wrap || !sel) return;
  if (!state.sheets.length) {
    wrap.hidden = true;
    sel.replaceChildren();
    return;
  }
  wrap.hidden = false;
  sheetSelectProgrammatic = true;
  try {
    sel.replaceChildren();
    for (const name of state.sheets) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    }
    if (state.currentSheet && state.sheets.includes(state.currentSheet)) {
      sel.value = state.currentSheet;
    }
  } finally {
    sheetSelectProgrammatic = false;
  }
}

function insertColumnNameIntoSearch(columnIndex) {
  const columns = getColumns();
  const name = columns[columnIndex];
  if (name === undefined) return;
  const token = String(name);
  const input = ui.searchInput;
  let v = input.value;
  if (!v.trim()) {
    input.value = `${token} `;
  } else if (/\s$/.test(v)) {
    input.value = `${v}${token} `;
  } else {
    input.value = `${v} ${token} `;
  }
  state.searchQuery = input.value;
  applyFilter();
  ui.tableWrap.scrollTop = 0;
  queueRender();
  input.focus();
  const end = input.value.length;
  input.setSelectionRange(end, end);
}

function setInfo(text, isError = false) {
  ui.fileInfo.textContent = text;
  ui.fileInfo.classList.toggle("meta-file--error", isError);
}

function run(task, prefix = "Error") {
  task().catch((error) => {
    setInfo(`${prefix}: ${String(error)}`, true);
  });
}

function getStoredTheme() {
  const value = localStorage.getItem(THEME_KEY);
  if (value === "light" || value === "dark") {
    return value;
  }
  return null;
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function effectiveTheme() {
  const stored = getStoredTheme();
  if (stored) {
    return stored;
  }
  return systemPrefersDark() ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const isDark = theme === "dark";
  const sun = $("themeIconSun");
  const moon = $("themeIconMoon");
  if (sun && moon) {
    sun.classList.toggle("icon-hidden", isDark);
    moon.classList.toggle("icon-hidden", !isDark);
  }
  if (ui.themeToggle) {
    ui.themeToggle.title = isDark ? "Hellmodus aktivieren" : "Dunkelmodus aktivieren";
    ui.themeToggle.setAttribute(
      "aria-label",
      isDark ? "Zum Hellmodus wechseln" : "Zum Dunkelmodus wechseln"
    );
  }
}

function initTheme() {
  applyTheme(effectiveTheme());
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!getStoredTheme()) {
      applyTheme(effectiveTheme());
    }
  });
}

function toggleTheme() {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

const APP_VERSION = "1.0.0";

function openAbout() {
  if (ui.aboutModalVersion) {
    ui.aboutModalVersion.textContent = APP_VERSION;
  }
  if (ui.aboutModal) {
    ui.aboutModal.hidden = false;
  }
  ui.aboutOkBtn?.focus();
}

function closeAbout() {
  if (ui.aboutModal) {
    ui.aboutModal.hidden = true;
  }
  ui.aboutBtn?.focus();
}

function displayDelimiter(delimiter) {
  if (delimiter === "\t") return "TAB";
  if (delimiter === " ") return "SPACE";
  return !delimiter || delimiter.trim() === "" ? "(none)" : delimiter;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sampleRows(rows, limit) {
  if (rows.length <= limit) {
    return rows;
  }

  const step = (rows.length - 1) / (limit - 1);
  return Array.from({ length: limit }, (_, index) => rows[Math.round(index * step)]);
}

function measurementContext() {
  measurementCanvas ||= document.createElement("canvas");
  return measurementCanvas.getContext("2d");
}

function measurementFont() {
  const style = getComputedStyle(document.body);
  return `400 13px ${style.fontFamily}`;
}

function measureTextWidth(text) {
  const context = measurementContext();
  if (!context) {
    return MIN_COLUMN_WIDTH;
  }

  context.font = measurementFont();
  return context.measureText(String(text ?? "")).width;
}

function refreshColumnMetrics() {
  const columns = getColumns();
  if (!columns.length) {
    state.columnWidths = [];
    state.totalWidth = 0;
    return;
  }

  const widths = columns.map((label) =>
    clamp(
      Math.ceil(measureTextWidth(label) + CELL_HORIZONTAL_PADDING),
      MIN_COLUMN_WIDTH,
      MAX_COLUMN_WIDTH
    )
  );

  for (const row of sampleRows(state.rows, COLUMN_SAMPLE_LIMIT)) {
    for (let index = 0; index < columns.length; index += 1) {
      const candidate = clamp(
        Math.ceil(measureTextWidth(row[index] ?? "") + CELL_HORIZONTAL_PADDING),
        MIN_COLUMN_WIDTH,
        MAX_COLUMN_WIDTH
      );
      if (candidate > widths[index]) {
        widths[index] = candidate;
      }
    }
  }

  state.columnWidths = widths;
  state.totalWidth = widths.reduce((sum, width) => sum + width, 0);
}

function gridTemplate() {
  return state.columnWidths.map((width) => `${width}px`).join(" ");
}

function currentViewportRange() {
  if (!visibleRows().length) {
    return { start: 0, end: 0, totalHeight: 0, displayStart: 0, displayEnd: 0 };
  }

  const scrollTop = Math.max(0, ui.tableWrap.scrollTop - state.headerHeight);
  const viewportHeight = Math.max(
    state.rowHeight,
    ui.tableWrap.clientHeight - state.headerHeight
  );
  const visibleStart = Math.floor(scrollTop / state.rowHeight);
  const visibleEnd = Math.ceil((scrollTop + viewportHeight) / state.rowHeight);
  const start = Math.max(0, visibleStart - OVERSCAN_ROWS);
  const end = Math.min(
    visibleRows().length,
    visibleEnd + OVERSCAN_ROWS
  );

  return {
    start,
    end,
    totalHeight: visibleRows().length * state.rowHeight,
    displayStart: Math.min(visibleRows().length, visibleStart + 1),
    displayEnd: Math.min(visibleRows().length, Math.max(visibleStart + 1, visibleEnd)),
  };
}

function updateMeta() {
  const range = currentViewportRange();
  ui.rowCount.textContent = state.searchQuery
    ? `${visibleRows().length}/${state.rows.length} rows`
    : `${state.rows.length} rows`;
  ui.columnCount.textContent = `${totalColumns()} columns`;
  ui.delimiterInfo.textContent = state.sheets.length
    ? "Format: XLSX"
    : `Delimiter: ${displayDelimiter(state.delimiter)}`;
  ui.viewInfo.textContent = visibleRows().length
    ? `Rows ${range.displayStart}-${range.displayEnd}`
    : "Rows 0-0";
  ui.exportBtn.disabled = !state.rows.length;
  ui.copyBtn.disabled = !visibleRows().length;
  ui.rowInput.disabled = !visibleRows().length;
  ui.jumpBtn.disabled = !visibleRows().length;
  ui.searchInput.disabled = !hasDataset();
  setInfo(state.filePath || "No file loaded");
  renderStats();
}

function renderStats() {
  const bar = ui.statsBar;
  if (!bar) return;
  const tc = totalColumns();
  if (state.statsColumnIndex < 0 || state.statsColumnIndex >= tc) {
    bar.hidden = true;
    return;
  }
  const stats = computeColumnStats(state.statsColumnIndex);
  if (!stats) {
    state.statsColumnIndex = -1;
    bar.hidden = true;
    queueRender();
    return;
  }
  const colName = getColumns()[state.statsColumnIndex];
  ui.statsName.textContent = `Spalte: ${colName}`;
  ui.statsSum.textContent = `Sum: ${statsNumberFmt.format(stats.sum)}`;
  ui.statsMin.textContent = `Min: ${statsNumberFmt.format(stats.min)}`;
  ui.statsMax.textContent = `Max: ${statsNumberFmt.format(stats.max)}`;
  ui.statsAvg.textContent = `Avg: ${statsNumberFmt.format(stats.avg)} (n=${stats.n})`;
  bar.hidden = false;
}

function handleHeaderStatsClick(columnIndex) {
  if (!Number.isFinite(columnIndex) || columnIndex < 0) return;
  if (state.statsColumnIndex === columnIndex) {
    state.statsColumnIndex = -1;
  } else {
    const stats = computeColumnStats(columnIndex);
    if (!stats) {
      state.statsColumnIndex = -1;
    } else {
      state.statsColumnIndex = columnIndex;
    }
  }
  renderStats();
  queueRender();
}

function parseNumericSearch(raw) {
  const s = raw.trim();
  if (!s) {
    return null;
  }

  const opNum = /^(>=|<=|>|<|=)\s*(-?\d+(?:[.,]\d+)?)\s*$/i;
  let m = s.match(opNum);
  if (m) {
    const threshold = parseFloat(m[2].replace(",", "."));
    if (Number.isNaN(threshold)) {
      return null;
    }
    return { column: null, operator: m[1].toLowerCase(), threshold };
  }

  const colOpNum = /^(.+?)\s*(>=|<=|>|<|=)\s*(-?\d+(?:[.,]\d+)?)\s*$/i;
  m = s.match(colOpNum);
  if (m) {
    const threshold = parseFloat(m[3].replace(",", "."));
    if (Number.isNaN(threshold)) {
      return null;
    }
    return { column: m[1].trim(), operator: m[2].toLowerCase(), threshold };
  }

  return null;
}

function cellToComparableNumber(cell) {
  if (cell === null || cell === undefined || cell === "") {
    return Number.NaN;
  }
  let text = String(cell).trim();
  if (!text) {
    return Number.NaN;
  }
  text = text.replace(/\s+/g, "");
  text = text.replace(",", ".");
  const num = parseFloat(text);
  return Number.isFinite(num) ? num : Number.NaN;
}

function computeColumnStats(colIndex) {
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let n = 0;
  for (const row of visibleRows()) {
    const v = cellToComparableNumber(row[colIndex]);
    if (Number.isNaN(v)) continue;
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
    n += 1;
  }
  if (!n) {
    return null;
  }
  return { n, sum, min, max, avg: sum / n };
}

function compareByOperator(num, operator, value) {
  switch (operator) {
    case ">":
      return num > value;
    case "<":
      return num < value;
    case ">=":
      return num >= value;
    case "<=":
      return num <= value;
    case "=":
      return Math.abs(num - value) < 1e-9;
    default:
      return false;
  }
}

function applyFilter() {
  const raw = state.searchQuery.trim();
  if (!raw) {
    state.filteredRows = state.rows;
    return;
  }

  const numeric = parseNumericSearch(raw);
  if (numeric) {
    const columns = getColumns();
    let colIndex = -1;
    if (numeric.column) {
      const key = numeric.column.toLowerCase();
      colIndex = columns.findIndex((h) => String(h).toLowerCase().trim() === key);
      if (colIndex === -1) {
        state.filteredRows = [];
        return;
      }
    }

    const { operator, threshold } = numeric;
    state.filteredRows = state.rows.filter((row) => {
      const checkCell = (cell) => {
        const num = cellToComparableNumber(cell);
        if (Number.isNaN(num)) {
          return false;
        }
        return compareByOperator(num, operator, threshold);
      };

      return colIndex !== -1 ? checkCell(row[colIndex]) : row.some(checkCell);
    });
    return;
  }

  const query = raw.toLowerCase();
  state.filteredRows = state.rows.filter((row) =>
    row.some((cell) => String(cell ?? "").toLowerCase().includes(query))
  );
}

function queueRender() {
  if (renderQueued) {
    return;
  }

  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderTable();
  });
}

function syncVirtualMeasurements() {
  measurementFrame = 0;

  const header = ui.tableWrap.querySelector(".virtual-header");
  const row = ui.tableWrap.querySelector(".virtual-row");
  let changed = false;

  if (header) {
    const nextHeaderHeight = Math.ceil(header.getBoundingClientRect().height);
    if (nextHeaderHeight > 0 && nextHeaderHeight !== state.headerHeight) {
      state.headerHeight = nextHeaderHeight;
      changed = true;
    }
  }

  if (row) {
    const nextRowHeight = Math.ceil(row.getBoundingClientRect().height);
    if (nextRowHeight > 0 && nextRowHeight !== state.rowHeight) {
      state.rowHeight = nextRowHeight;
      changed = true;
    }
  }

  if (changed) {
    queueRender();
  }
}

function renderEmptyState(title, copy) {
  ui.tableWrap.innerHTML = `
    <div class="empty-state">
      ${EMPTY_ICON_SVG}
      <p class="empty-title">${escapeHtml(title)}</p>
      <p class="empty-copy">${escapeHtml(copy)}</p>
    </div>
  `;
}

function renderTable() {
  if (!hasDataset()) {
    renderEmptyState(EMPTY_TITLE, EMPTY_TEXT);
    updateMeta();
    return;
  }

  if (!visibleRows().length) {
    renderEmptyState(
      state.searchQuery ? NO_MATCHES_TITLE : NO_DATA_TITLE,
      state.searchQuery ? NO_MATCHES_TEXT : NO_DATA_TEXT
    );
    updateMeta();
    return;
  }

  if (!state.columnWidths.length || state.columnWidths.length !== totalColumns()) {
    refreshColumnMetrics();
  }

  const columns = getColumns();
  const range = currentViewportRange();
  const template = gridTemplate();
  const head = columns
    .map(
      (value, index) =>
        `<div class="virtual-cell virtual-head-cell${
          index === state.statsColumnIndex ? " is-stats-active" : ""
        }" data-column-index="${index}" role="columnheader" title="${escapeHtml(
          "Einfachklick: numerische Statistiken. Doppelklick: Spaltenname in die Suche einfügen"
        )}">${escapeHtml(value)}</div>`
    )
    .join("");
  const body = visibleRows()
    .slice(range.start, range.end)
    .map((row, offset) => {
      const rowIndex = range.start + offset;
      const cells = columns
        .map((_, index) => `<div class="virtual-cell">${escapeHtml(row[index] ?? "")}</div>`)
        .join("");

      return `<div class="virtual-row virtual-grid" style="transform: translateY(${rowIndex * state.rowHeight}px);">${cells}</div>`;
    })
    .join("");

  ui.tableWrap.innerHTML = `
    <div class="virtual-table" style="--grid-columns: ${template}; --table-width: ${state.totalWidth}px;">
      <div class="virtual-header virtual-grid">${head}</div>
      <div class="virtual-body" style="height: ${range.totalHeight}px;">${body}</div>
    </div>
  `;
  updateMeta();

  if (!measurementFrame) {
    measurementFrame = requestAnimationFrame(syncVirtualMeasurements);
  }
}

async function loadFileFromPath(path, sheetName = null) {
  if (!tauri.core?.invoke) {
    throw new Error("Tauri API not available");
  }

  const isXlsx = isXlsxPath(path);
  if (isXlsx) {
    const payload = await tauri.core.invoke("read_xlsx", {
      path,
      sheet_name: sheetName ?? null,
    });
    Object.assign(state, {
      filePath: path,
      headers: payload.headers || [],
      rows: payload.rows || [],
      filteredRows: payload.rows || [],
      delimiter: "-",
      sheets: payload.sheets || [],
      currentSheet: payload.current_sheet || "",
      searchQuery: "",
      rowHeight: DEFAULT_ROW_HEIGHT,
      headerHeight: DEFAULT_HEADER_HEIGHT,
      columnWidths: [],
      totalWidth: 0,
      statsColumnIndex: -1,
    });
  } else {
    const payload = await tauri.core.invoke("read_csv", { path });
    Object.assign(state, {
      filePath: path,
      headers: payload.headers || [],
      rows: payload.rows || [],
      filteredRows: payload.rows || [],
      delimiter: payload.delimiter || "-",
      sheets: [],
      currentSheet: "",
      searchQuery: "",
      rowHeight: DEFAULT_ROW_HEIGHT,
      headerHeight: DEFAULT_HEADER_HEIGHT,
      columnWidths: [],
      totalWidth: 0,
      statsColumnIndex: -1,
    });
  }

  ui.searchInput.value = "";
  ui.rowInput.value = "";
  ui.tableWrap.scrollTop = 0;
  updateSheetSelector();
  renderTable();
}

async function openCsv() {
  if (!tauri.dialog?.open) {
    throw new Error("Dialog API not available");
  }

  const path = await tauri.dialog.open({
    multiple: false,
    filters: [{ name: "CSV / Excel", extensions: ["csv", "txt", "xlsx"] }],
  });

  if (path && !Array.isArray(path)) {
    await loadFileFromPath(path);
  }
}

async function exportXlsx() {
  if (!state.rows.length) {
    return;
  }
  if (!tauri.core?.invoke || !tauri.dialog?.save) {
    throw new Error("Tauri API not available");
  }

  const outputPath = await tauri.dialog.save({
    title: "Save XLSX",
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
    defaultPath: state.filePath
      ? state.filePath.replace(/\.[^/.\\]+$/, ".xlsx")
      : "export.xlsx",
  });

  if (!outputPath) {
    return;
  }

  await tauri.core.invoke("export_xlsx", {
    payload: {
      headers: state.headers,
      rows: state.rows,
      output_path: outputPath,
      sheet_name:
        state.sheets.length > 0 && state.currentSheet
          ? state.currentSheet
          : "CSV Export",
    },
  });

  setInfo(`Exported: ${outputPath}`);
}

function normalizeClipboardCell(value) {
  return String(value ?? "").replace(/\r?\n/g, " ").replace(/\t/g, " ");
}

function buildClipboardText() {
  if (!visibleRows().length) {
    return "";
  }

  const columns = getColumns();
  const lines = [
    columns.map((value) => normalizeClipboardCell(value)).join("\t"),
    ...visibleRows().map((row) =>
      columns
        .map((_, index) => normalizeClipboardCell(row[index]))
        .join("\t")
    ),
  ];

  return lines.join("\n");
}

async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(helper);

  if (!copied) {
    throw new Error("Clipboard API unavailable");
  }
}

async function copyCurrentTable() {
  const text = buildClipboardText();
  if (!text) {
    setInfo("Nothing to copy");
    return;
  }

  await writeClipboard(text);
  setInfo(`Copied ${visibleRows().length} rows to clipboard`);
}

function jumpToRow() {
  const target = Number.parseInt(ui.rowInput.value, 10);
  if (!Number.isInteger(target) || target < 1 || target > visibleRows().length) {
    setInfo(`Invalid row. Allowed: 1-${visibleRows().length}`, true);
    return;
  }

  ui.tableWrap.scrollTo({
    top: Math.max(0, state.headerHeight + (target - 1) * state.rowHeight),
  });
  queueRender();
}

function handleDropPath(path) {
  if (!path) {
    setInfo("Drop did not include a file path", true);
    return;
  }

  run(() => loadFileFromPath(path));
}

function setupDragAndDrop() {
  const toggleDropState = (active) => ui.tableWrap.classList.toggle("drag-over", active);

  window.addEventListener("dragover", (event) => {
    event.preventDefault();
    toggleDropState(true);
  });

  window.addEventListener("dragleave", () => toggleDropState(false));
  window.addEventListener("drop", (event) => {
    event.preventDefault();
    toggleDropState(false);
    handleDropPath(event.dataTransfer?.files?.[0]?.path);
  });

  tauri.event?.listen?.("csv-dropped", ({ payload }) => {
    handleDropPath(payload);
  });
}

async function loadStartupPath() {
  const startupPath = await tauri.core?.invoke?.("startup_csv_path");
  if (startupPath) {
    await loadFileFromPath(startupPath);
  }
}

function isEditableTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable === true
  );
}

initTheme();
ui.themeToggle?.addEventListener("click", toggleTheme);
ui.aboutBtn?.addEventListener("click", openAbout);

ui.aboutModal?.addEventListener("click", (event) => {
  if (event.target?.closest?.("[data-close-modal]")) {
    closeAbout();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!ui.aboutModal || ui.aboutModal.hidden) return;
  event.preventDefault();
  closeAbout();
});

ui.openBtn.addEventListener("click", () => run(openCsv));
ui.exportBtn.addEventListener("click", () => run(exportXlsx, "Export error"));
ui.copyBtn.addEventListener("click", () => run(copyCurrentTable, "Copy error"));
ui.jumpBtn.addEventListener("click", jumpToRow);
ui.searchInput.addEventListener("input", () => {
  state.searchQuery = ui.searchInput.value;
  applyFilter();
  ui.tableWrap.scrollTop = 0;
  queueRender();
});
ui.sheetSelector?.addEventListener("change", (event) => {
  if (sheetSelectProgrammatic) return;
  const name = event.target.value;
  if (state.filePath && name) {
    run(() => loadFileFromPath(state.filePath, name), "Sheet error");
  }
});
ui.rowInput.addEventListener("keydown", ({ key }) => {
  if (key === "Enter") {
    jumpToRow();
  }
});
ui.tableWrap.addEventListener("scroll", () => {
  if (state.rows.length) {
    queueRender();
  }
});
ui.tableWrap.addEventListener("click", (event) => {
  const cell = event.target.closest(".virtual-head-cell");
  if (!cell) return;
  if (event.detail === 2) {
    return;
  }
  window.clearTimeout(headerStatsClickTimer);
  headerStatsClickTimer = window.setTimeout(() => {
    headerStatsClickTimer = 0;
    const idx = Number.parseInt(cell.dataset.columnIndex ?? "", 10);
    handleHeaderStatsClick(idx);
  }, 250);
});
ui.tableWrap.addEventListener("dblclick", (event) => {
  const cell = event.target.closest(".virtual-head-cell");
  if (!cell) return;
  window.clearTimeout(headerStatsClickTimer);
  headerStatsClickTimer = 0;
  const idx = Number.parseInt(cell.dataset.columnIndex ?? "", 10);
  if (!Number.isFinite(idx) || idx < 0) return;
  insertColumnNameIntoSearch(idx);
});
window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
    if (isEditableTarget(event.target) || !visibleRows().length) {
      return;
    }

    const selection = window.getSelection()?.toString();
    if (selection) {
      return;
    }

    event.preventDefault();
    run(copyCurrentTable, "Copy error");
  }
});
new ResizeObserver(() => {
  if (state.rows.length) {
    queueRender();
  }
}).observe(ui.tableWrap);

setupDragAndDrop();
applyFilter();
renderTable();
run(loadStartupPath, "Startup error");
