// #schedule — 날짜 → 시간 → 인원
import { PARTY } from '../data.js';
import { state, setSchedule, isScheduleComplete } from '../state.js';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_AHEAD = 3;

// 12:00 ~ 20:00, 30분 단위
const TIMES = [];
for (let m = 12 * 60; m <= 20 * 60; m += 30) {
  TIMES.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${m % 60 ? '30' : '00'}`);
}

let root;
let view; // 달력에 보이는 달의 1일

// ---------- 날짜 도우미 (schedule·receipt 공용) ----------
const pad = (n) => String(n).padStart(2, '0');
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// "11월 14일 (토) · 18:00 · 아가씨 외 1인"
export function scheduleSummary({ date, time, party }) {
  const d = parseKey(date);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]}) · ${time} · ${PARTY[party]}`;
}

// 오늘이면 이미 지난 시각은 고를 수 없음
function isPastTime(dateKey, time) {
  if (dateKey !== toKey(today())) return false;
  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  return h * 60 + m <= now.getHours() * 60 + now.getMinutes();
}

// ---------- 렌더 ----------
function renderCalendar() {
  const cal = root.querySelector('[data-calendar]');
  const t = today();
  const minMonth = new Date(t.getFullYear(), t.getMonth(), 1);
  const maxMonth = new Date(t.getFullYear(), t.getMonth() + MONTHS_AHEAD, 1);
  const y = view.getFullYear();
  const m = view.getMonth();
  const days = new Date(y, m + 1, 0).getDate();

  cal.innerHTML = `
    <div class="cal-head">
      <button class="cal-nav" type="button" data-cal-move="-1" aria-label="이전 달">‹</button>
      <p class="cal-title" aria-live="polite">${y}년 ${m + 1}월</p>
      <button class="cal-nav" type="button" data-cal-move="1" aria-label="다음 달">›</button>
    </div>
    <div class="cal-grid"></div>`;
  cal.querySelector('[data-cal-move="-1"]').disabled = view <= minMonth;
  cal.querySelector('[data-cal-move="1"]').disabled = view >= maxMonth;

  const grid = cal.querySelector('.cal-grid');
  WEEK.forEach((w) => {
    const el = document.createElement('span');
    el.className = 'cal-wd';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = w;
    grid.append(el);
  });
  for (let i = 0; i < view.getDay(); i++) grid.append(document.createElement('span'));

  for (let d = 1; d <= days; d++) {
    const date = new Date(y, m, d);
    const key = toKey(date);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-day';
    btn.dataset.date = key;
    btn.textContent = d;
    btn.disabled = date < t;
    btn.setAttribute('aria-label', `${m + 1}월 ${d}일 ${WEEK[date.getDay()]}요일`);
    btn.setAttribute('aria-pressed', String(key === state.schedule.date));
    if (key === toKey(t)) btn.classList.add('is-today');
    grid.append(btn);
  }
}

function renderTimes() {
  const { date, time } = state.schedule;
  const wrap = root.querySelector('[data-times]');
  wrap.replaceChildren(...TIMES.map((t) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.dataset.time = t;
    btn.textContent = t;
    btn.disabled = Boolean(date) && isPastTime(date, t);
    btn.setAttribute('aria-pressed', String(t === time));
    return btn;
  }));
}

function renderSteps() {
  const { date, time, party } = state.schedule;
  root.querySelector('[data-step="time"]').hidden = !date;
  root.querySelector('[data-step="party"]').hidden = !(date && time);
  root.querySelectorAll('[data-party]').forEach((b) => {
    b.setAttribute('aria-pressed', String(Number(b.dataset.party) === party));
  });

  const done = isScheduleComplete();
  root.querySelector('[data-schedule-summary]').textContent =
    done ? scheduleSummary(state.schedule) : '일정을 모두 정해 주십시오';
  root.querySelector('[data-to-receipt]').disabled = !done;
}

function reveal(step) {
  const card = root.querySelector(`[data-step="${step}"]`);
  if (card.hidden) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
}

// ---------- 화면 ----------
export function init(el) {
  root = el;

  el.querySelector('[data-calendar]').addEventListener('click', (e) => {
    const move = e.target.closest('[data-cal-move]');
    if (move) {
      view = new Date(view.getFullYear(), view.getMonth() + Number(move.dataset.calMove), 1);
      renderCalendar();
      el.querySelector(`[data-cal-move="${move.dataset.calMove}"]`).focus();
      return;
    }
    const day = e.target.closest('[data-date]');
    if (!day) return;
    const { time } = state.schedule;
    setSchedule({ date: day.dataset.date, time: time && isPastTime(day.dataset.date, time) ? null : time });
    el.querySelectorAll('[data-date]').forEach((b) => b.setAttribute('aria-pressed', String(b === day)));
    renderTimes();
    renderSteps();
    reveal('time');
  });

  el.querySelector('[data-times]').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-time]');
    if (!chip) return;
    setSchedule({ time: chip.dataset.time });
    el.querySelectorAll('[data-time]').forEach((b) => b.setAttribute('aria-pressed', String(b === chip)));
    renderSteps();
    reveal('party');
  });

  el.querySelectorAll('[data-party]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setSchedule({ party: Number(btn.dataset.party) });
      renderSteps();
    });
  });

  el.querySelector('[data-to-receipt]').addEventListener('click', () => {
    location.hash = '#receipt';
  });
}

export function show() {
  // 저장된 날짜·시간이 이미 지났으면 비움
  const { date, time } = state.schedule;
  if (date && parseKey(date) < today()) setSchedule({ date: null, time: null });
  else if (date && time && isPastTime(date, time)) setSchedule({ time: null });

  const base = state.schedule.date ? parseKey(state.schedule.date) : today();
  view = new Date(base.getFullYear(), base.getMonth(), 1);
  renderCalendar();
  renderTimes();
  renderSteps();
}
