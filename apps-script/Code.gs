// 304호 만찬 품평록 — Google Sheets 저장용 Apps Script
//
// 배포:
// 1. 새 Google 스프레드시트 → 확장 프로그램 → Apps Script → 이 파일 내용 붙여넣고 저장
// 2. 배포 → 새 배포 → 유형 "웹 앱" / 실행 계정 "나" / 액세스 권한 "모든 사용자" → 배포 → 권한 승인
// 3. 나온 웹 앱 URL(…/exec)을 js/data.js의 REVIEWS_API_URL에 넣기
// 코드를 고친 뒤에는 "배포 관리 → 수정 → 새 버전"으로 다시 배포해야 반영됨.

const SHEET_NAME = 'reviews';
const HEADERS = ['id', 'at', 'rating', 'name', 'text'];
const DEFAULT_NAME = '익명의 귀빈';
const TEXT_MAX = 80;
const NAME_MAX = 12;

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
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

function doGet() {
  const rows = sheet_().getDataRange().getValues().slice(1);
  const reviews = rows
    .filter((r) => r[0])
    .map(([id, at, rating, name, text]) => ({
      id: String(id),
      at: Number(at),
      rating: Number(rating),
      name: String(name),
      text: String(text),
    }));
  return json_({ ok: true, reviews });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false });
  }

  const rating = Math.round(Number(body.rating));
  const text = String(body.text || '').trim().slice(0, TEXT_MAX);
  const name = String(body.name || '').trim().slice(0, NAME_MAX) || DEFAULT_NAME;
  if (!(rating >= 1 && rating <= 5) || !text) return json_({ ok: false });

  const review = { id: Utilities.getUuid(), at: Date.now(), rating, name, text };
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    sheet_().appendRow([review.id, review.at, review.rating, plain_(review.name), plain_(review.text)]);
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true, review });
}
