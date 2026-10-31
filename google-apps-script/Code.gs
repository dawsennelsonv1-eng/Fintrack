/**
* FinTrack v8 — Complete Multi-Entity Google Apps Script Backend
*
* Supports both:
*  - Raw JSON POST bodies (`JSON.parse(e.postData.contents)`)
*  - Form-encoded POST bodies (`e.parameter.payload`)
*  - Multi-tab persistence (Transactions, Buckets, Goals, BudgetItems, Debts,
*    DebtEvents, Investments, Ventures, Recurring, Templates, Categories, Meta)
*  - Seamless backward-compatibility with v1 single-tab Transactions sheets
*/
const COLLECTIONS = {
transaction:          'Transactions',
bucket:               'Buckets',
goal:                 'Goals',
budget:               'Budgets',
budgetItem:           'BudgetItems',
debt:                 'Debts',
debtEvent:            'DebtEvents',
investment:           'Investments',
investmentEvent:      'InvestmentEvents',
venture:              'Ventures',
ventureEvent:         'VentureEvents',
ventureDistribution:  'VentureDistributions',
ventureMilestone:     'VentureMilestones',
ventureJournal:       'VentureJournal',
borrowedDeployment:   'BorrowedDeployments',
recurring:            'Recurring',
pending:              'Pending',
template:             'Templates',
category:             'Categories',
};
function jsonResponse(obj) {
return ContentService
.createTextOutput(JSON.stringify(obj))
.setMimeType(ContentService.MimeType.JSON);
}
function parseBody(e) {
if (!e) return {};
if (e.parameter && e.parameter.payload) {
return JSON.parse(e.parameter.payload);
}
if (e.postData && e.postData.contents) {
const raw = e.postData.contents;
if (raw.startsWith('payload=')) {
return JSON.parse(decodeURIComponent(raw.slice(8).replace(/\+/g, ' ')));
}
return JSON.parse(raw);
}
return {};
}
function ensureSheet(ss, name) {
let sheet = ss.getSheetByName(name);
if (!sheet) {
sheet = ss.insertSheet(name);
sheet.appendRow(['id', 'dataJson', 'updatedAt']);
}
return sheet;
}
function readAllFromSheet(ss, name) {
const sheet = ss.getSheetByName(name);
if (!sheet) return [];
const rows = sheet.getDataRange().getValues();
if (rows.length <= 1) return [];
const headers = rows[0].map(String);
const dataJsonIdx = headers.indexOf('dataJson');
const out = [];
for (let i = 1; i < rows.length; i++) {
const row = rows[i];
if (!row[0]) continue;
if (dataJsonIdx >= 0 && row[dataJsonIdx]) {
try {
out.push(JSON.parse(row[dataJsonIdx]));
continue;
} catch (err) {}
}
const obj = {};
for (let c = 0; c < headers.length; c++) {
const k = headers[c];
let val = row[c];
if ((k === 'buckets' || k === 'bucketSplit') && typeof val === 'string' && val.startsWith('{')) {
try { val = JSON.parse(val); } catch (e) {}
}
obj[k] = val;
}
out.push(obj);
}
return out;
}
function upsertRow(ss, sheetName, item) {
const sheet = ensureSheet(ss, sheetName);
const rows = sheet.getDataRange().getValues();
const headers = rows[0].map(String);
const idIdx = headers.indexOf('id') >= 0 ? headers.indexOf('id') : 0;
const dataJsonIdx = headers.indexOf('dataJson');
let targetRow = -1;
for (let i = 1; i < rows.length; i++) {
if (String(rows[i][idIdx]) === String(item.id)) {
targetRow = i + 1;
break;
}
}
if (dataJsonIdx >= 0) {
const rowValues = [item.id, JSON.stringify(item), item.updatedAt || new Date().toISOString()];
if (targetRow > 0) {
sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
return { status: 200, message: 'Updated', id: item.id };
} else {
sheet.appendRow(rowValues);
return { status: 200, message: 'Created', id: item.id };
}
}
const rowValues = headers.map((h) => {
const v = item[h];
if (v === undefined || v === null) return '';
if (typeof v === 'object') return JSON.stringify(v);
return v;
});
if (targetRow > 0) {
sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
return { status: 200, message: 'Transaction updated', id: item.id };
} else {
sheet.appendRow(rowValues);
return { status: 200, message: 'Transaction created', id: item.id };
}
}
function deleteRow(ss, sheetName, id) {
const sheet = ss.getSheetByName(sheetName);
if (!sheet) return { status: 200, message: 'Sheet not created yet', id };
const rows = sheet.getDataRange().getValues();
for (let i = rows.length - 1; i >= 1; i--) {
if (String(rows[i][0]) === String(id)) {
sheet.deleteRow(i + 1);
return { status: 200, message: 'Deleted', id };
}
}
return { status: 404, error: 'Not found', id };
}
function doGet() {
try {
const ss = SpreadsheetApp.getActiveSpreadsheet();
const transactions = readAllFromSheet(ss, 'Transactions');
return jsonResponse({
status: 200,
version: 8,
transactions,
count: transactions.length,
buckets:              readAllFromSheet(ss, 'Buckets'),
goals:                readAllFromSheet(ss, 'Goals'),
budgets:              readAllFromSheet(ss, 'Budgets'),
budgetItems:          readAllFromSheet(ss, 'BudgetItems'),
debts:                readAllFromSheet(ss, 'Debts'),
debtEvents:           readAllFromSheet(ss, 'DebtEvents'),
investments:          readAllFromSheet(ss, 'Investments'),
investmentEvents:     readAllFromSheet(ss, 'InvestmentEvents'),
ventures:             readAllFromSheet(ss, 'Ventures'),
ventureEvents:        readAllFromSheet(ss, 'VentureEvents'),
ventureDistributions: readAllFromSheet(ss, 'VentureDistributions'),
ventureMilestones:    readAllFromSheet(ss, 'VentureMilestones'),
ventureJournal:       readAllFromSheet(ss, 'VentureJournal'),
borrowedDeployments:  readAllFromSheet(ss, 'BorrowedDeployments'),
recurring:            readAllFromSheet(ss, 'Recurring'),
pending:              readAllFromSheet(ss, 'Pending'),
templates:            readAllFromSheet(ss, 'Templates'),
categories:           readAllFromSheet(ss, 'Categories'),
});
} catch (err) {
return jsonResponse({ status: 500, error: String(err.message || err) });
}
}
function doPost(e) {
try {
const body = parseBody(e);
const ss = SpreadsheetApp.getActiveSpreadsheet();
const action = body.action;
if (action === 'ping') {
return jsonResponse({ status: 200, message: 'pong', version: 8 });
}
if (action === 'bulk') {
const ops = Array.isArray(body.operations) ? body.operations : [];
const results = ops.map((op) => {
const entity = op.entity || 'transaction';
const sheetName = COLLECTIONS[entity] || 'Transactions';
if (op.action === 'delete') {
return deleteRow(ss, sheetName, op.id);
}
return upsertRow(ss, sheetName, op);
});
return jsonResponse({ status: 200, message: 'Bulk processed', results });
}
const entity = body.entity || 'transaction';
const sheetName = COLLECTIONS[entity] || 'Transactions';
if (action === 'create' || action === 'update') {
return jsonResponse(upsertRow(ss, sheetName, body));
}
if (action === 'delete') {
return jsonResponse(deleteRow(ss, sheetName, body.id));
}
return jsonResponse({ status: 400, error: 'Unknown action: ' + action });
} catch (err) {
return jsonResponse({ status: 500, error: String(err.message || err) });
}
}
