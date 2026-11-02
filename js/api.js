// Apps Script 웹 앱 호출 + 메뉴·예약 불가 설정 불러오기
import { REVIEWS_API_URL as API_URL, MENU, MENU_BY_ID, BLOCKED, OPTION_SETS, TABS } from './data.js';

const CACHE_KEY = '304-config';

export async function apiGet(params = {}) {
  const url = new URL(API_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  return res.json();
}

// text/plain으로 보내야 Apps Script가 CORS 사전 요청 없이 받음
export async function apiPost(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  // Apps Script가 권한 문제 등으로 JSON 대신 오류 페이지를 주면 원인을 짐작해 돌려줌
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: /authoriz|권한/i.test(text) ? 'scope' : `server ${res.status}` };
  }
}

// data.js의 MENU·MENU_BY_ID·BLOCKED·OPTION_SETS·TABS를 제자리에서 바꿔, 가져다 쓰는 화면들이 그대로 새 값을 보게 함
export function applyConfig({ menu, blocked, options, tabs } = {}) {
  if (Array.isArray(tabs) && tabs.length) TABS.splice(0, TABS.length, ...tabs);
  if (Array.isArray(menu) && menu.length) {
    MENU.splice(0, MENU.length, ...menu);
    Object.keys(MENU_BY_ID).forEach((k) => delete MENU_BY_ID[k]);
    menu.forEach((m) => { MENU_BY_ID[m.id] = m; });
  }
  if (blocked) Object.assign(BLOCKED, { weekdays: [], dates: [], times: [], slots: {} }, blocked);
  if (options && Object.keys(options).length) {
    Object.keys(OPTION_SETS).forEach((k) => delete OPTION_SETS[k]);
    Object.assign(OPTION_SETS, options);
  }
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) ?? {};
  } catch {
    return {};
  }
}

// 새 설정을 적용·저장하고 열린 화면에 알림
export function updateConfig(partial) {
  const next = { ...readCache(), ...partial };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {}
  applyConfig(partial);
  window.dispatchEvent(new Event('config'));
}

export async function fetchConfig() {
  const data = await apiGet({ action: 'config' });
  if (!data.ok) throw new Error('config failed');
  return { menu: data.menu, blocked: data.blocked, options: data.options, tabs: data.tabs };
}

// 시작 시: 지난번 설정을 먼저 적용해 바로 그리고, 최신 설정이 오면 다시 그림
export function loadConfig() {
  applyConfig(readCache());
  if (!API_URL) return;
  fetchConfig().then(updateConfig).catch(() => {});
}
