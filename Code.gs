/**
 * Offsite breakout signup: Google Apps Script web app backed by this spreadsheet.
 *
 * Tabs (created by setup()):
 *   Settings  - event name, subtitle, intro text, company choices, open/closed switch
 *   Sessions  - one row per breakout; ID must stay stable once people sign up
 *   Signups   - one row per person (email is the key; signing up again switches session)
 *
 * Invites are sent by hand: the Sessions tab shows a comma-separated guest list
 * per session to paste into the Google Calendar event.
 */

const TAB = { settings: 'Settings', sessions: 'Sessions', signups: 'Signups' };

/** Run once from the Apps Script editor to create the tabs with placeholder content. */
function setup() {
  const ss = SpreadsheetApp.getActive();

  const settings = ensureTab_(ss, TAB.settings, [
    ['Setting', 'Value'],
    ['Event name', 'Offsite breakout sessions'],
    ['Subtitle', 'Date · Location (TBD)'],
    ['Intro', 'Pick one breakout session. You can switch until signups close.'],
    ['Companies', 'Mirantis, Company B'],
    ['Signups open', true],
  ]);
  if (settings) {
    settings.getRange('B6').insertCheckboxes();
    settings.setColumnWidth(1, 140).setColumnWidth(2, 420);
  }

  const placeholders = [
    ['S1', 'Breakout 1 (title TBD)', 'Room A (TBD)', 6, ''],
    ['S2', 'Breakout 2 (title TBD)', 'Room B (TBD)', 6, ''],
    ['S3', 'Breakout 3 (title TBD)', 'Room C (TBD)', 6, ''],
    ['S4', 'Breakout 4 (title TBD)', 'Room D (TBD)', '', ''],
  ];
  const sessionRows = [['ID', 'Title', 'Room', 'Capacity (blank = no limit)', 'Description', 'Signed up', 'Guest emails (paste into invite)']]
    .concat(placeholders.map((r, i) => {
      const row = i + 2;
      return r.concat([
        `=COUNTIF(Signups!E:E, A${row})`,
        `=IFERROR(TEXTJOIN(", ", TRUE, FILTER(Signups!C:C, Signups!E:E = A${row})), "")`,
      ]);
    }));
  const sessions = ensureTab_(ss, TAB.sessions, sessionRows);
  if (sessions) {
    sessions.setColumnWidth(2, 240).setColumnWidth(3, 160).setColumnWidth(5, 300).setColumnWidth(7, 420);
    sessions.getRange('F1:G1').setBackground('#eef1f5');
  }

  ensureTab_(ss, TAB.signups, [['Timestamp', 'Name', 'Email', 'Company', 'Session ID']]);
}

function doGet() {
  const settings = getSettings_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(settings.eventName || 'Breakout signup')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * JSON API for the copy of the page hosted outside Google (e.g. GitHub Pages).
 * Body is {action, ...args} sent as text/plain so browsers skip the CORS preflight.
 * The page sends no Google cookies, which avoids the multi-account "unable to open the file" error.
 */
function doPost(e) {
  let result;
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (body.action === 'getState') result = { ok: true, data: getState(body.email) };
    else if (body.action === 'signUp') result = { ok: true, data: signUp(body.form || {}) };
    else if (body.action === 'cancel') result = { ok: true, data: cancel(body.email) };
    else throw new Error('Unknown action.');
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

/** Public state for the page. Emails are never returned, only names and companies. */
function getState(email) {
  const signups = readSignups_();
  const key = clean_(email, 120).toLowerCase();
  const me = key ? signups.find(r => r.email === key) : null;
  return {
    settings: getSettings_(),
    mySessionId: me ? me.sessionId : null,
    sessions: readSessions_().map(s => Object.assign({}, s, {
      attendees: signups
        .filter(r => r.sessionId === s.id)
        .map(r => ({ name: r.name, company: r.company })),
    })),
  };
}

/** Adds a signup, or moves an existing one (same email) to the chosen session. */
function signUp(form) {
  const name = clean_(form.name, 80);
  const email = clean_(form.email, 120).toLowerCase();
  const company = clean_(form.company, 80);
  const sessionId = clean_(form.sessionId, 20);
  if (!name || !company) throw new Error('Please enter your name and company.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (!getSettings_().open) throw new Error('Signups are closed.');
    const session = readSessions_().find(s => s.id === sessionId);
    if (!session) throw new Error('That session is no longer available. Please refresh.');

    const signups = readSignups_();
    const existing = signups.find(r => r.email === email);
    const taken = signups.filter(r => r.sessionId === sessionId && r.email !== email).length;
    if (session.capacity && taken >= session.capacity) throw new Error('Sorry, that session just filled up.');

    const row = [new Date(), name, email, company, sessionId];
    const sh = sheet_(TAB.signups);
    if (existing) sh.getRange(existing.row, 1, 1, row.length).setValues([row]);
    else sh.appendRow(row);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return getState(email);
}

/** Removes the signup for this email. */
function cancel(email) {
  const key = clean_(email, 120).toLowerCase();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_(TAB.signups);
    readSignups_()
      .filter(r => r.email === key)
      .map(r => r.row)
      .sort((a, b) => b - a)
      .forEach(row => sh.deleteRow(row));
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return getState(key);
}

function getSettings_() {
  const rows = sheet_(TAB.settings).getDataRange().getValues().slice(1);
  const map = {};
  rows.forEach(r => { map[String(r[0]).trim()] = r[1]; });
  const open = map['Signups open'];
  return {
    eventName: String(map['Event name'] || ''),
    subtitle: String(map['Subtitle'] || ''),
    intro: String(map['Intro'] || ''),
    companies: String(map['Companies'] || '').split(',').map(s => s.trim()).filter(Boolean),
    open: open === true || String(open).toUpperCase() === 'TRUE',
  };
}

function readSessions_() {
  return sheet_(TAB.sessions).getDataRange().getValues().slice(1)
    .filter(r => String(r[0]).trim() && String(r[1]).trim())
    .map(r => ({
      id: String(r[0]).trim(),
      title: String(r[1]),
      room: String(r[2]),
      capacity: r[3] === '' ? null : Number(r[3]),
      description: String(r[4] || ''),
    }));
}

function readSignups_() {
  return sheet_(TAB.signups).getDataRange().getValues().slice(1)
    .map((r, i) => ({
      row: i + 2,
      name: String(r[1]),
      email: String(r[2]).trim().toLowerCase(),
      company: String(r[3]),
      sessionId: String(r[4]).trim(),
    }))
    .filter(r => r.email);
}

function sheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error(`Missing "${name}" tab. Run setup() from the Apps Script editor.`);
  return sh;
}

/** Creates a tab with rows if it does not exist yet; returns it, or null if it already existed. */
function ensureTab_(ss, name, rows) {
  if (ss.getSheetByName(name)) return null;
  const sh = ss.insertSheet(name);
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, rows[0].length).setFontWeight('bold');
  return sh;
}

/** Trims, caps length and strips leading formula characters so input can't become a sheet formula. */
function clean_(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max).replace(/^[=+\-@]+/, '').trim();
}
