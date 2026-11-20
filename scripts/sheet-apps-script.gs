/**
 * KSI Taster Morning: shared applicant sheet.
 *
 * Paste this into the sheet (Extensions > Apps Script), then:
 *   1. Project Settings > Script properties: add TOKEN (the same value as SHEET_WEBHOOK_TOKEN in Vercel).
 *   2. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *   3. Put the /exec URL in Vercel as SHEET_WEBHOOK_URL.
 *
 * The landing page webhook POSTs {"token": "...", "row": [...18 values...]}.
 * A row whose Response ID (column R) is already in the sheet is skipped, so a re-send is harmless.
 * Columns S onwards (English level (teacher), Teacher note) are for staff and are never written here.
 */
var SHEET_NAME = 'Applicants';
var COLUMNS = 18; // A to R
var TEXT_COLUMNS = [5, 7]; // Phone and Date of birth: keep exactly as written

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad json' });
  }
  var token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!token || body.token !== token) return json_({ ok: false, error: 'unauthorized' });
  var row = body.row;
  if (!row || row.length !== COLUMNS) return json_({ ok: false, error: 'bad row' });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    var last = sheet.getLastRow();
    var id = String(row[COLUMNS - 1]);
    if (id && last > 1) {
      var ids = sheet.getRange(2, COLUMNS, last - 1, 1).getDisplayValues();
      for (var i = 0; i < ids.length; i++) if (ids[i][0] === id) return json_({ ok: true, duplicate: true });
    }
    var target = sheet.getRange(last + 1, 1, 1, COLUMNS);
    TEXT_COLUMNS.forEach(function (c) { sheet.getRange(last + 1, c).setNumberFormat('@'); });
    target.setValues([row.map(function (v) { return v == null ? '' : String(v); })]);
    return json_({ ok: true, row: last + 1 });
  } finally {
    lock.releaseLock();
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
