use csv::StringRecord;
use encoding_rs::{UTF_16BE, UTF_16LE, WINDOWS_1252};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{Emitter, WindowEvent};

const DELIMITER_CANDIDATES: [u8; 4] = [b',', b';', b'\t', b'|'];
const DELIMITER_SAMPLE_LINES: usize = 20;

#[derive(Debug, Serialize)]
struct CsvData {
    headers: Vec<String>,
    rows: Vec<Vec<String>>,
    delimiter: char,
}

#[derive(Debug, Deserialize)]
struct ExportRequest {
    headers: Vec<String>,
    rows: Vec<Vec<String>>,
    output_path: String,
    sheet_name: Option<String>,
}

fn decode_text(bytes: &[u8]) -> String {
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return String::from_utf8_lossy(&bytes[3..]).to_string();
    }

    if bytes.starts_with(&[0xFF, 0xFE]) {
        let (text, _, _) = UTF_16LE.decode(&bytes[2..]);
        return text.into_owned();
    }

    if bytes.starts_with(&[0xFE, 0xFF]) {
        let (text, _, _) = UTF_16BE.decode(&bytes[2..]);
        return text.into_owned();
    }

    if let Ok(text) = std::str::from_utf8(bytes) {
        return text.to_string();
    }

    let (text, _, _) = WINDOWS_1252.decode(bytes);
    text.into_owned()
}

fn detect_delimiter(sample: &str) -> u8 {
    let lines = sample
        .lines()
        .take(DELIMITER_SAMPLE_LINES)
        .collect::<Vec<_>>();
    let mut best = b',';
    let mut best_count = 0usize;

    for candidate in DELIMITER_CANDIDATES {
        let count = lines
            .iter()
            .map(|line| {
                line.as_bytes()
                    .iter()
                    .filter(|ch| **ch == candidate)
                    .count()
            })
            .sum::<usize>();

        if count > best_count {
            best_count = count;
            best = candidate;
        }
    }

    best
}

fn extract_separator_hint(text: &str) -> Option<(u8, &str)> {
    let first_line_end = text.find('\n').unwrap_or(text.len());
    let first_line = text[..first_line_end].trim_end_matches('\r');
    let separator = first_line.strip_prefix("sep=").or_else(|| first_line.strip_prefix("SEP="))?;
    let delimiter = separator.as_bytes().first().copied()?;
    let remaining = text.get(first_line_end.saturating_add(1)..).unwrap_or("");

    Some((delimiter, remaining))
}

fn normalize_row(record: &StringRecord, expected_len: usize) -> Vec<String> {
    let mut row = record.iter().map(str::to_owned).collect::<Vec<_>>();
    if row.len() < expected_len {
        row.resize(expected_len, String::new());
    }
    row
}

#[tauri::command]
fn read_csv(path: String) -> Result<CsvData, String> {
    let file_path = Path::new(&path);
    let bytes = std::fs::read(file_path).map_err(|e| format!("Could not read CSV: {e}"))?;
    let text = decode_text(&bytes);

    let (delimiter, csv_text) = match extract_separator_hint(&text) {
        Some((delimiter, csv_text)) => (delimiter, csv_text),
        None => (detect_delimiter(&text), text.as_str()),
    };

    let mut reader = csv::ReaderBuilder::new()
        .delimiter(delimiter)
        .has_headers(true)
        .flexible(true)
        .from_reader(csv_text.as_bytes());

    let headers_record = reader
        .headers()
        .map_err(|e| format!("Could not read headers: {e}"))?
        .clone();

    let headers = headers_record
        .iter()
        .map(ToString::to_string)
        .collect::<Vec<_>>();

    let expected_len = headers.len();
    let mut rows: Vec<Vec<String>> = Vec::new();

    for result in reader.records() {
        let record = result.map_err(|e| format!("Error in CSV row: {e}"))?;
        rows.push(normalize_row(&record, expected_len));
    }

    Ok(CsvData {
        headers,
        rows,
        delimiter: delimiter as char,
    })
}

#[tauri::command]
fn startup_csv_path() -> Option<String> {
    let arg = std::env::args().nth(1)?;
    let path = Path::new(&arg);
    let ext = path.extension().and_then(|e| e.to_str())?;

    if matches!(ext.to_ascii_lowercase().as_str(), "csv" | "txt") && path.exists() {
        return Some(arg);
    }

    None
}

#[tauri::command]
fn export_xlsx(payload: ExportRequest) -> Result<(), String> {
    let mut book = umya_spreadsheet::new_file();
    let sheet_name = payload
        .sheet_name
        .filter(|n| !n.trim().is_empty())
        .unwrap_or_else(|| "CSV Export".to_string());

    let default_name = "Sheet1";
    if sheet_name != default_name {
        let ws = book
            .get_sheet_by_name_mut(default_name)
            .ok_or_else(|| "Default sheet not found".to_string())?;
        ws.set_name(sheet_name.clone());
    }

    let sheet = book
        .get_sheet_by_name_mut(&sheet_name)
        .ok_or_else(|| "Could not create sheet".to_string())?;

    for (col_idx, header) in payload.headers.iter().enumerate() {
        sheet
            .get_cell_mut(((col_idx + 1) as u32, 1u32))
            .set_value_string(header);
    }

    for (row_idx, row) in payload.rows.iter().enumerate() {
        let y = (row_idx + 2) as u32;
        for (col_idx, value) in row.iter().enumerate() {
            let x = (col_idx + 1) as u32;
            sheet.get_cell_mut((x, y)).set_value_string(value);
        }
    }

    let output = Path::new(&payload.output_path);
    if let Some(parent) = output.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Could not create output directory: {e}"))?;
    }

    umya_spreadsheet::writer::xlsx::write(&book, output)
        .map_err(|e| format!("XLSX export failed: {e}"))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(|window, event| {
            if let WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                if let Some(path) = paths.first() {
                    let value = path.to_string_lossy().to_string();
                    let _ = window.emit("csv-dropped", value);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_csv,
            startup_csv_path,
            export_xlsx
        ])
        .run(tauri::generate_context!())
        .expect("Failed to start Tauri");
}
