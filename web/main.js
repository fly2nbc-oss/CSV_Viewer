const EMPTY_TITLE = "No dataset loaded";
const EMPTY_TEXT = "Load a CSV via button or drag and drop.";
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
};

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

function setInfo(text) {
  ui.fileInfo.textContent = text;
}

function run(task, prefix = "Error") {
  task().catch((error) => {
    setInfo(`${prefix}: ${String(error)}`);
  });
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
  ui.delimiterInfo.textContent = `Delimiter: ${displayDelimiter(state.delimiter)}`;
  ui.viewInfo.textContent = visibleRows().length
    ? `Rows ${range.displayStart}-${range.displayEnd}`
    : "Rows 0-0";
  ui.exportBtn.disabled = !state.rows.length;
  ui.copyBtn.disabled = !visibleRows().length;
  ui.rowInput.disabled = !visibleRows().length;
  ui.jumpBtn.disabled = !visibleRows().length;
  ui.searchInput.disabled = !hasDataset();
  setInfo(state.filePath || "No file loaded");
}

function applyFilter() {
  const query = state.searchQuery.toLowerCase();
  if (!query) {
    state.filteredRows = state.rows;
    return;
  }

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
    .map((value) => `<div class="virtual-cell virtual-head-cell">${escapeHtml(value)}</div>`)
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

async function loadCsvFromPath(path) {
  if (!tauri.core?.invoke) {
    throw new Error("Tauri API not available");
  }

  const payload = await tauri.core.invoke("read_csv", { path });
  Object.assign(state, {
    filePath: path,
    headers: payload.headers || [],
    rows: payload.rows || [],
    filteredRows: payload.rows || [],
    delimiter: payload.delimiter || "-",
    searchQuery: "",
    rowHeight: DEFAULT_ROW_HEIGHT,
    headerHeight: DEFAULT_HEADER_HEIGHT,
    columnWidths: [],
    totalWidth: 0,
  });
  ui.searchInput.value = "";
  ui.rowInput.value = "";
  ui.tableWrap.scrollTop = 0;
  renderTable();
}

async function openCsv() {
  if (!tauri.dialog?.open) {
    throw new Error("Dialog API not available");
  }

  const path = await tauri.dialog.open({
    multiple: false,
    filters: [{ name: "CSV", extensions: ["csv", "txt"] }],
  });

  if (path && !Array.isArray(path)) {
    await loadCsvFromPath(path);
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
      sheet_name: "CSV Export",
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
    setInfo(`Invalid row. Allowed: 1-${visibleRows().length}`);
    return;
  }

  ui.tableWrap.scrollTo({
    top: Math.max(0, state.headerHeight + (target - 1) * state.rowHeight),
  });
  queueRender();
}

function handleDropPath(path) {
  if (!path) {
    setInfo("Drop did not include a file path");
    return;
  }

  run(() => loadCsvFromPath(path));
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
    await loadCsvFromPath(startupPath);
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
