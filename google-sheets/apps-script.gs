/**
 * Growvate — Lead Capture (Google Apps Script)
 * Receives POST requests from the landing page and appends each lead
 * as a new row in the active Google Sheet, then emails you a notification.
 *
 * Deploy as a Web App:
 *   - Execute as: Me
 *   - Who has access: Anyone
 *
 * Then paste the deployed URL into LEAD_ENDPOINT in script.js.
 */

// ─── CONFIG ────────────────────────────────────────────────
// Where to send "new lead" emails. Use a comma-separated list for multiple recipients.
const NOTIFY_EMAILS = 'growvatestudio@gmail.com';
// Set to false to disable email notifications (rows still get appended to the sheet).
const NOTIFY_ENABLED = true;
// ───────────────────────────────────────────────────────────

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

/**
 * Run this once from the Apps Script editor to authorize the MailApp scope.
 * After authorizing, lead notifications will be sent automatically on every
 * form submission. You can re-run this any time to verify mail is working.
 */
function authorizeMail() {
  MailApp.sendEmail({
    to: NOTIFY_EMAILS,
    subject: '✦ Growvate auth test — MailApp authorized',
    body: 'If you received this, MailApp is authorized and lead notifications will work.\n\nSent at: ' + new Date().toISOString(),
    name: 'Growvate Leads'
  });
}

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

    // Email notification on every new lead
    if (NOTIFY_ENABLED) {
      notify(data, sheet);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Send a plain-text notification email about a captured lead.
 * Wrapped in try/catch so a mail failure never breaks the sheet write.
 */
function notify(data, sheet) {
  try {
    const sheetUrl = sheet.getParent().getUrl();
    const isNotify = (data.mode || '').toLowerCase() === 'notify';
    const verb = isNotify ? 'requested notify for' : 'downloaded';
    const subject = '✦ Growvate lead: ' + (data.name || 'Unknown') + ' — ' + (data.resource || 'unknown resource');
    const body = [
      'A new lead just came in from growvate.com — ' + verb + ' "' + (data.resource || '—') + '".',
      '',
      'Name:       ' + (data.name      || '—'),
      'Email:      ' + (data.email     || '—'),
      'Use type:   ' + (data.useType   || '—'),
      'Resource:   ' + (data.resource  || '—'),
      'Mode:       ' + (data.mode      || '—'),
      'Time:       ' + (data.timestamp || new Date().toISOString()),
      '',
      'User agent: ' + (data.userAgent || '—'),
      '',
      'View all leads in the sheet:',
      sheetUrl,
      '',
      '— Growvate auto-notify'
    ].join('\n');

    MailApp.sendEmail({
      to: NOTIFY_EMAILS,
      subject: subject,
      body: body,
      name: 'Growvate Leads'
    });
  } catch (err) {
    // Log only; never throw from notify(). Row is already saved.
    console.error('notify() failed:', err);
  }
}

/** Healthcheck — visit the deployed URL in a browser to confirm it's live. */
function doGet() {
  return ContentService
    .createTextOutput('Growvate lead endpoint is live ✦ ' + new Date().toISOString())
    .setMimeType(ContentService.MimeType.TEXT);
}
