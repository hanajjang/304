// 파인다이닝 304 — 품평록 · 메뉴 · 예약 불가 설정을 Google Sheets에, 메뉴 사진을 Google Drive에 저장하는 Apps Script
//
// 배포:
// 1. 새 Google 스프레드시트 → 확장 프로그램 → Apps Script → 이 파일 내용 붙여넣고 저장
// 2. 프로젝트 설정(톱니바퀴) → 스크립트 속성 → ADMIN_PASSWORD 추가 (관리자 화면 비밀번호)
// 3. 배포 → 새 배포 → 유형 "웹 앱" / 실행 계정 "나" / 액세스 권한 "모든 사용자" → 배포 → 권한 승인
// 4. 나온 웹 앱 URL(…/exec)을 js/data.js의 REVIEWS_API_URL에 넣기
// 코드를 고친 뒤에는 "배포 관리 → 수정 → 새 버전"으로 다시 배포해야 반영됨.
// 사진 저장이 권한 문제로 실패하면: 편집기 위쪽 함수 목록에서 authorize 선택 → 실행 → 권한 승인.

// 편집기에서 한 번 실행해 Drive·시트 권한을 승인받는 용도
function authorize() {
  DriveApp.getRootFolder();
  SpreadsheetApp.getActiveSpreadsheet();
}

const SHEET_NAME = 'reviews';
const HEADERS = ['id', 'at', 'rating', 'name', 'text'];
const DEFAULT_NAME = '익명의 귀빈';
const TEXT_MAX = 80;
const NAME_MAX = 12;

const MENU_SHEET = 'menu';
const MENU_HEADERS = ['id', 'tab', 'name', 'short', 'desc', 'bill', 'option', 'photo', 'c1', 'c2'];
const MENU_LIMITS = { id: 40, tab: 10, name: 30, short: 12, desc: 200, bill: 40, option: 10, photo: 300, c1: 30, c2: 30 };
const TAB_KEY = /^[a-z0-9_]{1,20}$/;
const OPTION_KEY = /^[A-Z0-9_]{1,20}$/;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY = /^\d{2}:\d{2}$/;
const SETTINGS_SHEET = 'settings';
const PHOTO_FOLDER = '파인다이닝 304 메뉴 사진';
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const LOGIN_FAIL_LIMIT = 10; // 10분에 10번 틀리면 잠시 잠금

function sheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// =, +, -, @ 로 시작하면 수식으로 실행되지 않게 글자로 저장
function plain_(s) {
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// ---------- 읽기 ----------
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'config') {
    return json_({
      ok: true,
      menu: readMenu_(),
      blocked: getSetting_('blocked'),
      options: getSetting_('options'),
      tabs: getSetting_('tabs'),
    });
  }
  return json_({ ok: true, reviews: readReviews_() });
}

function readReviews_() {
  const rows = sheet_(SHEET_NAME, HEADERS).getDataRange().getValues().slice(1);
  return rows
    .filter((r) => r[0])
    .map(([id, at, rating, name, text]) => ({
      id: String(id),
      at: Number(at),
      rating: Number(rating),
      name: String(name),
      text: String(text),
    }));
}

// 시트에 메뉴가 아직 없으면 null → 앱은 js/data.js의 기본 메뉴를 씀
function readMenu_() {
  const rows = sheet_(MENU_SHEET, MENU_HEADERS).getDataRange().getValues().slice(1).filter((r) => r[0]);
  if (!rows.length) return null;
  return rows.map((r) => {
    const item = {};
    MENU_HEADERS.forEach((h, i) => { item[h] = String(r[i]); });
    item.option = item.option || null;
    return item;
  });
}

// settings 탭: key | value(JSON) — blocked(예약 불가), options(옵션 종류), tabs(메뉴 분류)
function getSetting_(key) {
  const rows = sheet_(SETTINGS_SHEET, ['key', 'value']).getDataRange().getValues();
  const row = rows.find((r) => r[0] === key);
  try {
    return row ? JSON.parse(row[1]) : null;
  } catch (err) {
    return null;
  }
}

function setSetting_(key, value) {
  withLock_(() => {
    const sh = sheet_(SETTINGS_SHEET, ['key', 'value']);
    const rows = sh.getDataRange().getValues();
    const i = rows.findIndex((r) => r[0] === key);
    if (i > -1) sh.getRange(i + 1, 2).setNumberFormat('@').setValue(JSON.stringify(value));
    else sh.appendRow([key, JSON.stringify(value)]);
  });
}

// ---------- 쓰기 ----------
// 어떤 오류든 JSON으로 돌려줘서 관리자 화면에 원인이 보이게 함
function doPost(e) {
  try {
    return handlePost_(e);
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function handlePost_(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false });
  }

  if (!body.action) return addReview_(body);

  if (!authed_(body.password)) return json_({ ok: false, error: 'auth' });
  switch (body.action) {
    case 'login': return json_({ ok: true });
    case 'saveMenu': return saveMenu_(body.menu);
    case 'saveBlocked': return saveBlocked_(body.blocked);
    case 'saveOptions': return saveOptions_(body.options);
    case 'saveTabs': return saveTabs_(body.tabs);
    case 'uploadPhoto': return uploadPhoto_(body);
    default: return json_({ ok: false });
  }
}

function addReview_(body) {
  const rating = Math.round(Number(body.rating));
  const text = String(body.text || '').trim().slice(0, TEXT_MAX);
  const name = String(body.name || '').trim().slice(0, NAME_MAX) || DEFAULT_NAME;
  if (!(rating >= 1 && rating <= 5) || !text) return json_({ ok: false });

  const review = { id: Utilities.getUuid(), at: Date.now(), rating, name, text };
  withLock_(() => {
    sheet_(SHEET_NAME, HEADERS).appendRow([review.id, review.at, review.rating, plain_(review.name), plain_(review.text)]);
  });
  return json_({ ok: true, review });
}

function authed_(password) {
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('loginFails') || 0);
  if (fails >= LOGIN_FAIL_LIMIT) return false;
  const real = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  const ok = Boolean(real) && String(password || '') === real;
  if (!ok) cache.put('loginFails', String(fails + 1), 600);
  return ok;
}

// 메뉴는 목록 전체를 통째로 교체
function saveMenu_(menu) {
  if (!Array.isArray(menu) || !menu.length || menu.length > 100) return json_({ ok: false });
  const rows = [];
  for (const item of menu) {
    const row = MENU_HEADERS.map((h) => String(item[h] == null ? '' : item[h]).trim().slice(0, MENU_LIMITS[h]));
    const [id, tab, name, short, , bill, option, photo] = row;
    if (!/^[\w-]+$/.test(id) || !TAB_KEY.test(tab) || !name || !short || !bill || (option && !OPTION_KEY.test(option))) {
      return json_({ ok: false });
    }
    if (photo && !/^https:\/\//.test(photo)) return json_({ ok: false });
    rows.push(row);
  }
  // 텍스트 서식(@)으로 저장 → 수식 실행·날짜/숫자 자동 변환 없음
  withLock_(() => {
    const sh = sheet_(MENU_SHEET, MENU_HEADERS);
    sh.clearContents();
    sh.getRange(1, 1, 1, MENU_HEADERS.length).setValues([MENU_HEADERS]);
    sh.getRange(2, 1, rows.length, MENU_HEADERS.length).setNumberFormat('@').setValues(rows);
  });
  return json_({ ok: true });
}

// weekdays: 매주 막는 요일, dates: 하루 전체 막는 날짜, times: 매일 막는 시간, slots: { 날짜: [그날만 막는 시간] }
function saveBlocked_(blocked) {
  const b = blocked || {};
  const times = (list) => (Array.isArray(list) ? list : []).map(String).filter((t) => TIME_KEY.test(t));
  const slots = {};
  Object.keys(b.slots || {}).filter((d) => DATE_KEY.test(d)).slice(0, 400).forEach((d) => {
    const t = times(b.slots[d]);
    if (t.length) slots[d] = t;
  });
  const clean = {
    weekdays: (b.weekdays || []).map(Number).filter((d) => d >= 0 && d <= 6),
    dates: (b.dates || []).map(String).filter((d) => DATE_KEY.test(d)).slice(0, 400),
    times: times(b.times),
    slots,
  };
  setSetting_('blocked', clean);
  return json_({ ok: true, blocked: clean });
}

// 옵션 종류 전체를 통째로 교체. free = 손님이 한 줄로 직접 적는 옵션
function saveOptions_(options) {
  if (!options || typeof options !== 'object') return json_({ ok: false });
  const keys = Object.keys(options);
  if (!keys.length || keys.length > 20) return json_({ ok: false });
  const clean = {};
  for (const key of keys) {
    const set = options[key] || {};
    if (!OPTION_KEY.test(key)) return json_({ ok: false });
    const name = String(set.name || '').trim().slice(0, 20);
    const question = String(set.question || '').trim().slice(0, 120);
    if (!name) return json_({ ok: false });
    if (set.free) {
      clean[key] = { name, question, free: true };
      continue;
    }
    const choices = (Array.isArray(set.choices) ? set.choices : []).slice(0, 8)
      .map((c) => ({ label: String(c.label || '').trim().slice(0, 20), note: String(c.note || '').trim().slice(0, 60) }))
      .filter((c) => c.label);
    if (!choices.length) return json_({ ok: false });
    clean[key] = { name, question, choices };
  }
  setSetting_('options', clean);
  return json_({ ok: true, options: clean });
}

// 메뉴 분류(탭) 목록을 통째로 교체: [{ id, label }]
function saveTabs_(tabs) {
  if (!Array.isArray(tabs) || !tabs.length || tabs.length > 12) return json_({ ok: false });
  const seen = {};
  const clean = [];
  for (const t of tabs) {
    const id = String((t && t.id) || '');
    const label = String((t && t.label) || '').trim().slice(0, 10);
    if (!TAB_KEY.test(id) || !label || seen[id]) return json_({ ok: false });
    seen[id] = true;
    clean.push({ id, label });
  }
  setSetting_('tabs', clean);
  return json_({ ok: true, tabs: clean });
}

function photoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PHOTO_FOLDER_ID');
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (err) {}
  }
  const folder = DriveApp.createFolder(PHOTO_FOLDER);
  props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  return folder;
}

// 사진은 링크가 있는 사람 누구나 볼 수 있게 공유해야 손님 화면에 보임
function uploadPhoto_(body) {
  const mime = String(body.mime || '');
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) return json_({ ok: false });
  const bytes = Utilities.base64Decode(String(body.data || ''));
  if (!bytes.length || bytes.length > PHOTO_MAX_BYTES) return json_({ ok: false });
  const file = photoFolder_().createFile(Utilities.newBlob(bytes, mime, `menu-${Date.now()}`));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return json_({ ok: true, url: `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w800` });
}
