/**
 * KSI Taster Morning: shared applicant sheet.
 *
 * Paste this into the sheet (Extensions > Apps Script), then:
 *   1. Project Settings > Script properties: add TOKEN (the same value as SHEET_WEBHOOK_TOKEN in Vercel).
 *   2. First time: Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *      Updating: Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy (keeps the same URL).
 *   3. Put the /exec URL in Vercel as SHEET_WEBHOOK_URL.
 *
 * The landing page POSTs JSON with the token and an action:
 *   {"action": "append", "row": [...18 values, A to R...], "cap": 6}
 *       Adds the booking and decides its Status (column S): Confirmed while the child's Taster group
 *       (column J) has fewer Confirmed rows than cap, otherwise Waitlist. Decided under a lock, so two
 *       parents cannot both take the last place. A Response ID (column R) already in the sheet is not
 *       added again; its stored Status is returned.
 *   {"action": "counts"}
 *       Confirmed rows per Taster group, for the places shown on the page.
 *
 * Staff free a place by changing a row's Status to Cancelled.
 * Columns T onwards (English level (teacher), Teacher note) are for staff and are never written here.
 */
var SHEET_NAME = 'Applicants';
var COLUMNS = 18; // A to R, written by the webhook
var GROUP_COL = 10; // J: Taster group
var ID_COL = 18; // R: Response ID
var STATUS_COL = 19; // S: Status
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

  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (body.action === 'counts') return json_({ ok: true, counts: counts_(sheet) });

  var row = body.row;
  if (!row || row.length !== COLUMNS) return json_({ ok: false, error: 'bad row' });
  var cap = typeof body.cap === 'number' ? body.cap : null;

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var last = sheet.getLastRow();
    var id = String(row[ID_COL - 1]);
    if (id && last > 1) {
      var data = sheet.getRange(2, 1, last - 1, STATUS_COL).getDisplayValues();
      for (var i = 0; i < data.length; i++) {
        if (data[i][ID_COL - 1] === id) return json_({ ok: true, duplicate: true, status: data[i][STATUS_COL - 1] || 'Confirmed' });
      }
    }
    var group = String(row[GROUP_COL - 1]);
    var taken = counts_(sheet)[group] || 0;
    // No cap sent (older webhook): confirm, as before. A cap of 0 (group not offered) means waitlist.
    var status = cap === null || taken < cap ? 'Confirmed' : 'Waitlist';
    TEXT_COLUMNS.forEach(function (c) { sheet.getRange(last + 1, c).setNumberFormat('@'); });
    var values = row.map(function (v) { return v == null ? '' : String(v); });
    values.push(status);
    sheet.getRange(last + 1, 1, 1, STATUS_COL).setValues([values]);
    return json_({ ok: true, row: last + 1, status: status, taken: taken + (status === 'Confirmed' ? 1 : 0) });
  } finally {
    lock.releaseLock();
  }
}

// Confirmed rows per Taster group. A row with an empty Status counts as Confirmed.
function counts_(sheet) {
  var out = {};
  var last = sheet.getLastRow();
  if (last < 2) return out;
  var data = sheet.getRange(2, 1, last - 1, STATUS_COL).getDisplayValues();
  for (var i = 0; i < data.length; i++) {
    var status = data[i][STATUS_COL - 1] || 'Confirmed';
    var group = data[i][GROUP_COL - 1];
    if (group && status === 'Confirmed') out[group] = (out[group] || 0) + 1;
  }
  return out;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
