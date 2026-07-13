const PROFILES_SHEET_ID = "14oLTRpoAJhhFYU6C6gMhCgt5n5Xa2FTlgrbLs2yDNPs";
const PROFILES_SHEET_NAME = "SOCIOS";
const PROFILES_START_COLUMN = "P";

function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const expectedSecret = props.getProperty("PROFILES_SYNC_SCRIPT_SECRET");

    if (!expectedSecret) {
      return jsonResponse({
        ok: false,
        error: "Missing PROFILES_SYNC_SCRIPT_SECRET.",
      });
    }

    const payload = JSON.parse(e.postData.contents || "{}");

    if (payload.secret !== expectedSecret) {
      return jsonResponse({
        ok: false,
        error: "Unauthorized.",
      });
    }

    if (!Array.isArray(payload.rows)) {
      return jsonResponse({
        ok: false,
        error: "Missing profiles rows.",
      });
    }

    const rows = payload.rows.map(profileRowToSheetValues);
    const spreadsheetId = props.getProperty("PROFILES_SHEET_ID") || PROFILES_SHEET_ID;
    const sheetName = sanitizeSheetName(
      props.getProperty("PROFILES_SHEET_NAME") || PROFILES_SHEET_NAME,
    );
    const startColumn = columnLetterToIndex(
      props.getProperty("PROFILES_SHEET_START_COLUMN") || PROFILES_START_COLUMN,
    );
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      const sheet = spreadsheet.getSheetByName(sheetName);

      if (!sheet) {
        throw new Error('Missing target sheet tab "' + sheetName + '".');
      }

      const syncResult = upsertProfileRows(sheet, rows, startColumn);

      return jsonResponse({
        ok: true,
        spreadsheetId: spreadsheet.getId(),
        sheetName: sheet.getName(),
        startColumn: columnIndexToLetter(startColumn),
        rowCount: syncResult.rowCount,
        insertedRows: syncResult.insertedRows,
        updatedRows: syncResult.updatedRows,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error && error.message ? error.message : String(error),
    });
  }
}

function upsertProfileRows(sheet, rows, startColumn) {
  const existingLastRow = sheet.getLastRow();
  const existingValues =
    existingLastRow > 1
      ? sheet.getRange(2, startColumn, existingLastRow - 1, 3).getValues()
      : [];
  const rowByKey = {};

  existingValues.forEach(function (values, index) {
    const key = getProfileRowKey(values);

    if (key && !rowByKey[key]) {
      rowByKey[key] = index + 2;
    }
  });

  let insertedRows = 0;
  let updatedRows = 0;
  let nextRow = getNextProfileWriteRow(sheet, startColumn);

  rows.forEach(function (row) {
    const key = getProfileRowKey(row);
    const rowNumber = key ? rowByKey[key] : null;

    if (rowNumber) {
      sheet
        .getRange(rowNumber, startColumn, 1, 3)
        .setNumberFormat("@")
        .setValues([row]);
      updatedRows += 1;
      return;
    }

    sheet.getRange(nextRow, startColumn, 1, 3).setNumberFormat("@").setValues([row]);
    insertedRows += 1;

    if (key) {
      rowByKey[key] = nextRow;
    }

    nextRow += 1;
  });

  sheet.autoResizeColumns(startColumn, 3);

  return {
    rowCount: Math.max(getNextProfileWriteRow(sheet, startColumn) - 2, 0),
    insertedRows: insertedRows,
    updatedRows: updatedRows,
  };
}

function getNextProfileWriteRow(sheet, startColumn) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const values = sheet.getRange(1, startColumn, lastRow, 3).getValues();

  for (let index = values.length - 1; index >= 1; index -= 1) {
    if (values[index].some(function (value) {
      return toSheetText(value);
    })) {
      return index + 2;
    }
  }

  return 2;
}

function getProfileRowKey(row) {
  const memberNumber = toSheetText(row && row[2]);
  const dni = toSheetText(row && row[1]);
  const fullName = toSheetText(row && row[0]);

  return memberNumber || dni || fullName;
}

function profileRowToSheetValues(row) {
  return [
    toSheetText(row && row.full_name),
    toSheetText(row && row.dni),
    toSheetText(row && row.member_number),
  ];
}

function toSheetText(value) {
  const text = value == null ? "" : String(value).trim();

  if (/^[=+\-@]/.test(text)) {
    return "'" + text;
  }

  return text;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function sanitizeSheetName(value) {
  const clean = String(value)
    .replace(/[\\/?*[\]:]/g, "-")
    .trim()
    .slice(0, 99);

  return clean || PROFILES_SHEET_NAME;
}

function columnLetterToIndex(value) {
  const letters = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  let index = 0;

  for (let position = 0; position < letters.length; position += 1) {
    index = index * 26 + letters.charCodeAt(position) - 64;
  }

  if (index < 1) {
    throw new Error("Invalid PROFILES_SHEET_START_COLUMN.");
  }

  return index;
}

function columnIndexToLetter(index) {
  let value = index;
  let letters = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }

  return letters;
}
