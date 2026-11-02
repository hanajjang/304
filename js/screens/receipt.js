// #receipt — 청구서 렌더, 서약 게이트, 클립보드/카톡 전송
import { MENU_BY_ID, OPTION_SETS, PARTY, KAKAO_JS_KEY } from '../data.js';
import { state, update, isScheduleComplete } from '../state.js';
import { parseKey, scheduleSummary } from './schedule.js';

const WEEK_LONG = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const KAKAO_SDK = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';
const KAKAO_TEXT_MAX = 200; // 카카오 텍스트 템플릿 글자 수 제한

let root;

function cartItems() {
  return state.cart
    .filter((c) => MENU_BY_ID[c.id])
    .map((c) => ({ ...MENU_BY_ID[c.id], picked: c.option }));
}

// "밥 양: 보통" / 자유 입력은 입력 문장 그대로
function optionText(item) {
  if (!item.picked) return '';
  const set = OPTION_SETS[item.option];
  return set.free ? item.picked : `${set.name}: ${item.picked}`;
}

// "리액션 11회 + 앙코르": N회는 합산, 횟수 없는 청구는 그대로 덧붙임
function totalSummary(items) {
  let count = 0;
  const extras = [];
  for (const item of items) {
    const nums = [...item.bill.matchAll(/(\d+)회/g)];
    nums.forEach((n) => { count += Number(n[1]); });
    if (!nums.length) extras.push(item.bill);
    if (item.bill.includes('앙코르')) extras.push('앙코르');
  }
  return [count ? `리액션 ${count}회` : '', ...new Set(extras)].filter(Boolean).join(' + ');
}

function kakaoText(items) {
  const { date, time, party } = state.schedule;
  const d = parseKey(date);
  const menu = items.map((item) => {
    const opt = optionText(item);
    return `  - ${item.name}${opt ? ` (${opt})` : ''}`;
  });
  return [
    '[304호 만찬 예약 심사 청구서]',
    `• 귀빈: ${PARTY[party]}`,
    `• 일시: ${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK_LONG[d.getDay()]} ${time}`,
    '• 하사받을 메뉴:',
    ...menu,
    `• 청구 내역: ${items.map((item) => item.bill).join(', ')}`,
    '• 결제 수단: 설거지 보조 10분 & 격렬한 리액션',
    '• 서약: 저택 엄벌 규정에 서약함',
    '"집사여, 이 일정으로 준비를 명하노라."',
  ].join('\n');
}

// ---------- 전송 ----------
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.className = 'sr-only';
  document.body.append(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  ta.remove();
  return ok;
}

function loadKakao() {
  if (!KAKAO_JS_KEY || window.Kakao) return;
  const script = document.createElement('script');
  script.src = KAKAO_SDK;
  script.crossOrigin = 'anonymous';
  script.addEventListener('load', () => {
    if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_JS_KEY);
  });
  document.head.append(script);
}

function openKakao(text) {
  if (window.Kakao?.isInitialized?.()) {
    const body = text.length > KAKAO_TEXT_MAX ? `${text.slice(0, KAKAO_TEXT_MAX - 1)}…` : text;
    window.Kakao.Share.sendDefault({
      objectType: 'text',
      text: body,
      link: { mobileWebUrl: location.href, webUrl: location.href },
    });
  } else {
    location.href = 'kakaotalk://';
  }
}

async function send() {
  const text = kakaoText(cartItems());
  const ok = await copy(text);
  const notice = root.querySelector('[data-sent-notice]');
  notice.querySelector('[data-sent-title]').textContent = ok ? '청구서가 복사되었습니다' : '[문구 필요]';
  notice.hidden = false;
  openKakao(text);
}

// ---------- 렌더 ----------
function render() {
  const items = cartItems();

  root.querySelector('[data-receipt-schedule]').textContent = scheduleSummary(state.schedule);
  root.querySelector('[data-receipt-no]').textContent = `304-${state.receiptNo}`;

  root.querySelector('[data-receipt-items]').replaceChildren(...items.map((item) => {
    const li = document.createElement('li');
    li.className = 'receipt-item';
    li.innerHTML = '<span class="receipt-item-name"></span><span class="receipt-item-bill"></span>';
    const name = li.querySelector('.receipt-item-name');
    name.textContent = item.name;
    const opt = optionText(item);
    if (opt) {
      const small = document.createElement('small');
      small.textContent = opt;
      name.append(small);
    }
    li.querySelector('.receipt-item-bill').textContent = item.bill;
    return li;
  }));

  root.querySelector('[data-receipt-total]').textContent = totalSummary(items);

  const pledge = root.querySelector('[data-pledge]');
  pledge.checked = state.pledge;
  root.querySelector('[data-send]').disabled = !state.pledge;
  root.querySelector('[data-sent-notice]').hidden = true;
}

// ---------- 화면 ----------
export function init(el) {
  root = el;

  el.querySelector('[data-pledge]').addEventListener('change', (e) => {
    update({ pledge: e.target.checked });
    el.querySelector('[data-send]').disabled = !state.pledge;
  });

  el.querySelector('[data-send]').addEventListener('click', send);

  loadKakao();
}

export function show() {
  // 메뉴·일정이 없으면 앞 단계로 돌려보냄
  if (!cartItems().length) return location.replace('#menu');
  if (!isScheduleComplete()) return location.replace('#schedule');

  if (!state.receiptNo) update({ receiptNo: String(Math.floor(Math.random() * 10000)).padStart(4, '0') });
  render();
}
