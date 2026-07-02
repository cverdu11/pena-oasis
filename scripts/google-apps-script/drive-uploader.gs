function doPost(e) {
  let scriptLock = null;
  let lockAcquired = false;

  try {
    const props = PropertiesService.getScriptProperties();
    const folderId = props.getProperty("DRIVE_FOLDER_ID");
    const expectedSecret = props.getProperty("UPLOAD_SECRET");

    if (!folderId || !expectedSecret) {
      return jsonResponse({
        ok: false,
        error: "Missing DRIVE_FOLDER_ID or UPLOAD_SECRET.",
      });
    }

    const payload = JSON.parse(e.postData.contents || "{}");

    if (payload.secret !== expectedSecret) {
      return jsonResponse({
        ok: false,
        error: "Unauthorized.",
      });
    }

    if (!payload.fileName || !payload.pdfBase64) {
      return jsonResponse({
        ok: false,
        error: "Missing fileName or pdfBase64.",
      });
    }

    const safeFileName = sanitizeFileName(payload.fileName);
    scriptLock = LockService.getScriptLock();
    scriptLock.waitLock(30000);
    lockAcquired = true;

    const folder = DriveApp.getFolderById(folderId);
    const existingFiles = folder.getFilesByName(safeFileName);

    if (existingFiles.hasNext()) {
      return fileResponse(existingFiles.next(), true);
    }

    const pdfBytes = Utilities.base64Decode(payload.pdfBase64);
    const blob = Utilities.newBlob(pdfBytes, "application/pdf", safeFileName);
    const file = folder.createFile(blob);

    return fileResponse(file, false);
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error && error.message ? error.message : String(error),
    });
  } finally {
    if (lockAcquired && scriptLock) {
      scriptLock.releaseLock();
    }
  }
}

function fileResponse(file, alreadyExisted) {
  return jsonResponse({
    ok: true,
    fileId: file.getId(),
    fileName: file.getName(),
    webViewLink: file.getUrl(),
    alreadyExisted: alreadyExisted,
  });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function sanitizeFileName(value) {
  const clean = String(value)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim();

  if (!clean) {
    return "acuerdo-firmado.pdf";
  }

  return clean.toLowerCase().endsWith(".pdf") ? clean : clean + ".pdf";
}
