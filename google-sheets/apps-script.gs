/**
 * Growvate — Lead Capture (Google Apps Script)
 * Receives POST requests from the landing page and appends each lead
 * as a new row in the active Google Sheet.
 *
 * Deploy as a Web App:
 *   - Execute as: Me
 *   - Who has access: Anyone
 *
 * Then paste the deployed URL into LEAD_ENDPOINT in script.js.
 */

const HEADERS = [
  'Timestamp',
  'Name',
  'Email',
  'Use Type',
  'Resource',
  'Mode',
  'User Agent',
  'Raw IP/Referrer (best-effort)'
];

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // First-run: write header row + freeze it
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
      // Light formatting on header row
      const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#0d0d0d');
      headerRange.setFontColor('#ffffff');
      sheet.autoResizeColumns(1, HEADERS.length);
    }

    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const data = JSON.parse(raw);

    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.name      || '',
      data.email     || '',
      data.useType   || '',
      data.resource  || '',
      data.mode      || '',
      data.userAgent || '',
      ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/** Healthcheck — visit the deployed URL in a browser to confirm it's live. */
function doGet() {
  return ContentService
    .createTextOutput('Growvate lead endpoint is live ✦ ' + new Date().toISOString())
    .setMimeType(ContentService.MimeType.TEXT);
}
