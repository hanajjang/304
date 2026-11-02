// #admin — 비밀번호 잠금, 메뉴 추가·수정·삭제·순서(사진 포함), 옵션 종류, 예약 불가 요일·날짜·시간
import { MENU, OPTION_SETS, TABS, BLOCKED } from '../data.js';
import { apiPost, fetchConfig, updateConfig } from '../api.js';
import { TIMES, WEEK, toKey, parseKey } from './schedule.js';
import { foodImage } from './menu.js';

const PW_KEY = '304-admin'; // 탭을 닫으면 지워지는 sessionStorage
const PHOTO_MAX = 900; // 올리기 전 긴 변 기준으로 줄임(px)

let root;
let password = null;
let menu = [];
let tabs = [];
let options = {};
let blocked = { weekdays: [], dates: [], times: [], slots: {} };
let editing = null; // 수정 중인 메뉴 (새 메뉴면 null)
let photo = { url: null, data: null }; // url: 기존 사진, data: 새로 고른 사진(base64)
let dayKey = null; // 예약 불가에서 편집 중인 날짜

const $ = (sel) => root.querySelector(sel);
const clone = (v) => JSON.parse(JSON.stringify(v));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(className, text, data = {}, label = null) {
  const btn = el('button', className, text);
  btn.type = 'button';
  Object.assign(btn.dataset, data);
  if (label) btn.setAttribute('aria-label', label);
  return btn;
}

function status(msg, isError = false) {
  const node = $('[data-admin-status]');
  node.textContent = msg;
  node.classList.toggle('is-error', isError);
}

// 원인을 알 수 있으면 함께 보여 줌 (Apps Script가 돌려준 오류 문장 등)
function failMsg(err, what = '저장하지') {
  if (err.message === 'auth') return '로그인이 풀렸습니다. 다시 들어가 주세요.';
  if (err.message === 'scope') return `${what} 못했습니다. Apps Script에서 authorize 함수를 한 번 실행해 권한을 승인해 주세요.`;
  const detail = err.message && err.message !== 'save' ? ` (원인: ${err.message})` : '';
  return `${what} 못했습니다. 잠시 뒤 다시 시도해 주세요.${detail}`;
}

// Enter로 제출하면 submitter가 없을 수 있어 폼의 제출 버튼으로 대신함
const submitBtn = (e) => e.submitter ?? e.target.querySelector('[type="submit"]');

async function busy(btn, fn) {
  btn.disabled = true;
  try {
    return await fn();
  } finally {
    btn.disabled = false;
  }
}

async function post(body) {
  const res = await apiPost({ ...body, password });
  if (!res.ok) throw new Error(res.error || 'save');
  return res;
}

// ---------- 로그인 ----------
async function login(pw) {
  const res = await apiPost({ action: 'login', password: pw });
  if (!res.ok) throw new Error(res.error || 'login');
  password = pw;
  try { sessionStorage.setItem(PW_KEY, pw); } catch {}
}

async function enter() {
  status('불러오는 중…');
  const cfg = await fetchConfig();
  // 시트에 아직 없으면 지금 앱에 있는 기본값에서 시작
  menu = clone(cfg.menu ?? MENU);
  tabs = clone(cfg.tabs ?? TABS);
  options = clone(cfg.options ?? OPTION_SETS);
  blocked = { weekdays: [], dates: [], times: [], slots: {}, ...clone(cfg.blocked ?? BLOCKED) };
  $('[data-admin-login]').hidden = true;
  $('[data-admin-body]').hidden = false;
  renderMenu();
  renderTabList();
  renderOptions();
  renderBlocked();
  status('');
}

// ---------- 메뉴 ----------
function renderMenu() {
  // 분류가 지워진 메뉴가 있으면 맨 아래 '분류 없음'으로 모아 보여 줌
  const known = new Set(tabs.map((t) => t.id));
  const orphan = menu.filter((m) => !known.has(m.tab)).map((m) => m.tab);
  const groups = [...tabs, ...[...new Set(orphan)].map((id) => ({ id, label: '분류 없음' }))];
  $('[data-admin-list]').replaceChildren(...groups.flatMap((tab) => {
    const items = menu.filter((m) => m.tab === tab.id);
    if (!items.length) return [];
    return [el('li', 'admin-group', tab.label), ...items.map((item, i) => {
      const li = el('li', 'admin-item');
      const thumb = el('span', 'admin-thumb');
      thumb.append(foodImage(item));
      const up = button('icon-btn admin-move', '↑', { move: -1, id: item.id }, `${item.name} 위로`);
      const down = button('icon-btn admin-move', '↓', { move: 1, id: item.id }, `${item.name} 아래로`);
      up.disabled = i === 0;
      down.disabled = i === items.length - 1;
      li.append(
        thumb,
        el('span', 'admin-item-name', item.name),
        el('span', 'admin-moves'),
        button('btn btn-sm', '수정', { edit: item.id }),
        button('btn btn-sm', '삭제', { delete: item.id }),
      );
      li.querySelector('.admin-moves').append(up, down);
      return li;
    })];
  }));
}

// 고른 옵션이 손님에게 어떻게 보이는지 메뉴 폼 안에서 바로 알려 줌
function renderOptionHint() {
  const hint = $('[data-admin-option-hint]');
  const set = options[$('[data-admin-options]').value];
  hint.hidden = !set;
  if (!set) return;
  const lines = [
    set.free ? '손님이 메뉴를 담을 때 한 줄 입력 칸이 나옵니다.' : `손님이 고를 선택지: ${(set.choices ?? []).map((c) => c.label).join(' / ')}`,
    `손님에게 묻는 말: ${set.question || '(비어 있음)'}`,
  ];
  if (/\[문구 필요\]/.test(set.name + set.question)) lines.push('이 옵션의 이름·묻는 말이 아직 [문구 필요]입니다.');
  hint.replaceChildren(
    ...lines.map((t) => el('p', null, t)),
    button('btn btn-sm', '이 옵션 고치기', { goOption: $('[data-admin-options]').value }),
  );
}

function fillOptionSelect() {
  const select = $('[data-admin-options]');
  select.replaceChildren(
    new Option('없음', ''),
    ...Object.entries(options).map(([key, set]) => new Option(set.free ? `${set.name} (자유 입력)` : set.name, key)),
  );
}

function setPreview(src, item) {
  const box = $('[data-admin-preview]');
  if (src) {
    const img = el('img', 'food-art food-photo');
    img.alt = '';
    img.src = src;
    box.replaceChildren(img);
  } else {
    box.replaceChildren(foodImage({ ...item, photo: '' }));
  }
}

function openForm(item) {
  const form = $('[data-admin-form]');
  editing = item;
  photo = { url: item?.photo || null, data: null };
  form.reset();
  fillOptionSelect();
  $('[data-admin-tabs]').replaceChildren(...tabs.map((t) => new Option(t.label, t.id)));
  $('[data-admin-form-title]').textContent = item ? '메뉴 수정' : '메뉴 추가';
  if (item) {
    for (const key of ['tab', 'name', 'short', 'desc', 'bill']) form.elements[key].value = item[key] ?? '';
    form.elements.option.value = options[item.option] ? item.option : '';
  }
  renderOptionHint();
  setPreview(photo.url, item ?? { id: '' });
  form.hidden = false;
  form.elements.tab.focus();
}

function closeForm() {
  $('[data-admin-form]').hidden = true;
  editing = null;
}

// 사진을 줄여 JPEG base64로
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_MAX / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

async function saveMenu(next, okMsg) {
  await post({ action: 'saveMenu', menu: next });
  menu = next;
  updateConfig({ menu: clone(next) });
  renderMenu();
  renderTabList(); // 분류별 메뉴 개수 갱신
  status(okMsg);
}

async function submitForm() {
  const f = $('[data-admin-form]').elements;
  let url = photo.url;
  if (photo.data) {
    status('사진 올리는 중…');
    url = (await post({ action: 'uploadPhoto', mime: 'image/jpeg', data: photo.data.split(',')[1] })).url;
  }
  const item = {
    ...(editing ?? { id: `m${Date.now().toString(36)}` }),
    tab: f.tab.value,
    name: f.name.value.trim(),
    short: f.short.value.trim(),
    desc: f.desc.value.trim(),
    bill: f.bill.value.trim(),
    option: f.option.value || null,
    photo: url || '',
  };
  const next = editing ? menu.map((m) => (m.id === editing.id ? item : m)) : [...menu, item];
  await saveMenu(next, editing ? '수정했습니다.' : '추가했습니다.');
  closeForm();
}

// 같은 분류 안에서 바로 옆 메뉴와 자리 바꾸기
async function move(id, dir) {
  const item = menu.find((m) => m.id === id);
  const same = menu.filter((m) => m.tab === item.tab);
  const other = same[same.indexOf(item) + dir];
  if (!other) return;
  const next = [...menu];
  const a = next.indexOf(item);
  const b = next.indexOf(other);
  [next[a], next[b]] = [next[b], next[a]];
  await saveMenu(next, '순서를 바꿨습니다.');
  // 다시 그린 뒤에도 같은 메뉴의 화살표에 포커스 유지
  const again = $(`[data-move="${dir}"][data-id="${id}"]`);
  (again && !again.disabled ? again : $(`[data-move="${-dir}"][data-id="${id}"]`))?.focus();
}

// ---------- 분류 ----------
function renderTabList() {
  $('[data-admin-tab-list]').replaceChildren(...tabs.map((t, i) => {
    const li = el('li', 'admin-item');
    li.dataset.tabId = t.id;
    const input = el('input', 'field admin-tab-label');
    Object.assign(input, { maxLength: 10, value: t.label });
    input.setAttribute('aria-label', `분류 ${i + 1} 이름`);
    const count = menu.filter((m) => m.tab === t.id).length;
    const up = button('icon-btn admin-move', '↑', { tabMove: -1 }, `${t.label} 위로`);
    const down = button('icon-btn admin-move', '↓', { tabMove: 1 }, `${t.label} 아래로`);
    up.disabled = i === 0;
    down.disabled = i === tabs.length - 1;
    const moves = el('span', 'admin-moves');
    moves.append(up, down);
    li.append(input, el('span', 'admin-count', `${count}개`), moves, button('btn btn-sm', '삭제', { tabDelete: '' }));
    return li;
  }));
}

// 화면에 입력 중인 이름을 tabs로 옮김
function collectTabs() {
  return [...root.querySelectorAll('[data-tab-id]')].map((li) => ({
    id: li.dataset.tabId,
    label: li.querySelector('.admin-tab-label').value.trim(),
  }));
}

// ---------- 옵션 ----------
function optionCard(key, set) {
  const card = el('div', 'card');
  card.dataset.optionKey = key;

  const name = el('label', 'admin-label', '옵션 이름 ');
  const nameInput = el('input', 'field');
  Object.assign(nameInput, { maxLength: 20, value: set.name ?? '' });
  nameInput.dataset.f = 'name';
  name.append(nameInput);

  const question = el('label', 'admin-label', '손님에게 묻는 말 ');
  const qInput = el('textarea', 'field field-area');
  Object.assign(qInput, { maxLength: 120, rows: 2, value: set.question ?? '' });
  qInput.dataset.f = 'question';
  question.append(qInput);

  card.append(name, question);

  if (set.free) {
    card.append(el('p', 'note', '손님이 한 줄로 직접 적는 옵션입니다.'));
  } else {
    const list = el('ul', 'admin-choices');
    (set.choices ?? []).forEach((c, i) => {
      const li = el('li', 'admin-choice');
      const label = el('input', 'field');
      Object.assign(label, { maxLength: 20, value: c.label ?? '', placeholder: '선택지' });
      label.dataset.c = 'label';
      label.setAttribute('aria-label', `선택지 ${i + 1}`);
      const note = el('input', 'field');
      Object.assign(note, { maxLength: 60, value: c.note ?? '', placeholder: '부연 설명' });
      note.dataset.c = 'note';
      note.setAttribute('aria-label', `선택지 ${i + 1} 부연 설명`);
      li.append(label, note, button('icon-btn', '×', { choiceRemove: i }, `선택지 ${i + 1} 빼기`));
      list.append(li);
    });
    card.append(list);
  }

  const row = el('div', 'admin-row');
  if (!set.free) row.append(button('btn btn-sm', '+ 선택지', { choiceAdd: '' }));
  row.append(button('btn btn-sm', '옵션 삭제', { optionDelete: '' }));
  card.append(row);
  return card;
}

function renderOptions() {
  $('[data-admin-option-list]').replaceChildren(...Object.entries(options).map(([k, s]) => optionCard(k, s)));
}

// 화면에 입력 중인 값을 options로 옮김 (다시 그리기 전에 항상 먼저)
function collectOptions() {
  const next = {};
  root.querySelectorAll('[data-option-key]').forEach((card) => {
    const key = card.dataset.optionKey;
    const set = { name: card.querySelector('[data-f="name"]').value.trim(), question: card.querySelector('[data-f="question"]').value.trim() };
    if (options[key]?.free) set.free = true;
    else {
      set.choices = [...card.querySelectorAll('.admin-choice')].map((li) => ({
        label: li.querySelector('[data-c="label"]').value.trim(),
        note: li.querySelector('[data-c="note"]').value.trim(),
      }));
    }
    next[key] = set;
  });
  return next;
}

function optionsProblem(opts) {
  for (const set of Object.values(opts)) {
    if (!set.name) return '이름이 빈 옵션이 있습니다.';
    if (!set.free && !set.choices.some((c) => c.label)) return `'${set.name}'에 선택지가 하나 이상 있어야 합니다.`;
  }
  if (!Object.keys(opts).length) return '옵션은 1개 이상 남아 있어야 합니다.';
  return null;
}

// ---------- 예약 불가 ----------
function chip(label, pressed, data) {
  const btn = button('chip', label, data);
  btn.setAttribute('aria-pressed', String(pressed));
  return btn;
}

const dateLabel = (key) => {
  const d = parseKey(key);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;
};

function renderDay() {
  const box = $('[data-admin-day]');
  box.hidden = !dayKey;
  if (!dayKey) return;
  const allDay = blocked.dates.includes(dayKey);
  const slots = blocked.slots[dayKey] ?? [];
  $('[data-admin-day-title]').textContent = dateLabel(dayKey);
  // 매주 요일 막기에 걸린 날이면, 여기서 시간을 골라도 손님은 그날을 아예 못 고름
  const weekday = parseKey(dayKey).getDay();
  const warn = $('[data-admin-day-warn]');
  warn.hidden = !blocked.weekdays.includes(weekday);
  warn.textContent = `매주 ${WEEK[weekday]}요일이 막혀 있어서, 손님은 이 날짜를 고를 수 없습니다. 이 날을 열려면 위 '요일 (매주)'에서 '${WEEK[weekday]}' 칸을 다시 눌러 풀어 주세요.`;
  $('[data-admin-allday]').setAttribute('aria-pressed', String(allDay));
  $('[data-admin-day-times]').replaceChildren(...TIMES.map((t) => {
    const btn = chip(t, allDay || slots.includes(t) || blocked.times.includes(t), { dayTime: t });
    // 하루 전체나 '매일' 시간으로 이미 막힌 칸은 여기서 풀 수 없음
    btn.disabled = allDay || blocked.times.includes(t);
    return btn;
  }));
}

function renderBlocked() {
  $('[data-admin-weekdays]').replaceChildren(...WEEK.map((w, i) => chip(w, blocked.weekdays.includes(i), { weekday: i })));
  $('[data-admin-times]').replaceChildren(...TIMES.map((t) => chip(t, blocked.times.includes(t), { time: t })));

  const keys = [...new Set([...blocked.dates, ...Object.keys(blocked.slots)])].sort();
  $('[data-admin-dates]').replaceChildren(...keys.map((key) => {
    const what = blocked.dates.includes(key) ? '하루 전체' : (blocked.slots[key] ?? []).slice().sort().join(', ');
    const li = el('li', 'admin-date');
    li.append(
      button('admin-date-edit', `${dateLabel(key)} · ${what}`, { dateEdit: key }),
      button('icon-btn', '×', { dateRemove: key }, `${dateLabel(key)} 막기 해제`),
    );
    return li;
  }));
  renderDay();
}

function toggle(list, value) {
  const i = list.indexOf(value);
  if (i > -1) list.splice(i, 1);
  else list.push(value);
}

// 지난 날짜·빈 날짜는 저장 전에 정리
function tidyBlocked() {
  const today = toKey(new Date());
  blocked.dates = blocked.dates.filter((d) => d >= today);
  for (const [d, t] of Object.entries(blocked.slots)) {
    if (d < today || !t.length || blocked.dates.includes(d)) delete blocked.slots[d];
  }
}

// ---------- 화면 ----------
function showPanel(name) {
  root.querySelectorAll('[data-admin-tab]').forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.adminTab === name)));
  root.querySelectorAll('[data-admin-panel]').forEach((p) => { p.hidden = p.dataset.adminPanel !== name; });
  status('');
}

export function init(node) {
  root = node;

  $('[data-admin-date]').min = toKey(new Date());

  $('[data-admin-login]').addEventListener('submit', async (e) => {
    e.preventDefault();
    await busy(submitBtn(e), async () => {
      try {
        await login(e.target.elements.password.value);
        await enter();
        e.target.reset();
      } catch (err) {
        status(err.message === 'auth' ? '비밀번호가 맞지 않습니다.' : '연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.', true);
      }
    });
  });

  $('.tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-admin-tab]');
    if (tab) showPanel(tab.dataset.adminTab);
  });

  // 메뉴
  $('[data-admin-add]').addEventListener('click', () => openForm(null));
  $('[data-admin-cancel]').addEventListener('click', closeForm);

  $('[data-admin-photo]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      photo.data = await shrink(file);
      setPreview(photo.data);
    } catch {
      status('이 사진은 열 수 없습니다. JPG나 PNG로 다시 골라 주세요.', true);
    }
    e.target.value = '';
  });

  $('[data-admin-photo-clear]').addEventListener('click', () => {
    photo = { url: null, data: null };
    setPreview(null, editing ?? { id: '' });
  });

  $('[data-admin-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    await busy(submitBtn(e), async () => {
      try {
        await submitForm();
      } catch (err) {
        status(failMsg(err), true);
      }
    });
  });

  $('[data-admin-list]').addEventListener('click', async (e) => {
    const mv = e.target.closest('[data-move]');
    if (mv) {
      return busy(mv, async () => {
        try {
          await move(mv.dataset.id, Number(mv.dataset.move));
        } catch (err) {
          status(failMsg(err, '순서를 바꾸지'), true);
        }
      });
    }
    const edit = e.target.closest('[data-edit]');
    if (edit) return openForm(menu.find((m) => m.id === edit.dataset.edit));
    const del = e.target.closest('[data-delete]');
    if (!del) return;
    const item = menu.find((m) => m.id === del.dataset.delete);
    if (menu.length === 1) return status('메뉴는 1개 이상 남아 있어야 합니다.', true);
    if (!confirm(`'${item.name}'을(를) 메뉴에서 삭제할까요?`)) return;
    await busy(del, async () => {
      try {
        await saveMenu(menu.filter((m) => m.id !== item.id), '삭제했습니다.');
      } catch (err) {
        status(failMsg(err, '삭제하지'), true);
      }
    });
  });

  $('[data-admin-options]').addEventListener('change', renderOptionHint);

  // 메뉴 폼의 '이 옵션 고치기' → 옵션 탭의 해당 카드로
  $('[data-admin-option-hint]').addEventListener('click', (e) => {
    const go = e.target.closest('[data-go-option]');
    if (!go) return;
    showPanel('options');
    const card = root.querySelector(`[data-option-key="${go.dataset.goOption}"]`);
    card?.scrollIntoView({ block: 'center' });
    card?.querySelector('[data-f="name"]').focus({ preventScroll: true });
  });

  // 분류
  $('[data-admin-tab-list]').addEventListener('click', (e) => {
    const li = e.target.closest('[data-tab-id]');
    if (!li) return;
    tabs = collectTabs();
    const i = tabs.findIndex((t) => t.id === li.dataset.tabId);
    const mv = e.target.closest('[data-tab-move]');
    if (mv) {
      const j = i + Number(mv.dataset.tabMove);
      [tabs[i], tabs[j]] = [tabs[j], tabs[i]];
    } else if (e.target.closest('[data-tab-delete]')) {
      const used = menu.filter((m) => m.tab === li.dataset.tabId).length;
      if (used) return status(`이 분류에 메뉴가 ${used}개 있어 삭제할 수 없습니다. 메뉴를 다른 분류로 옮기거나 삭제한 뒤 지워 주세요.`, true);
      if (tabs.length === 1) return status('분류는 1개 이상 남아 있어야 합니다.', true);
      tabs.splice(i, 1);
    } else {
      return;
    }
    renderTabList();
  });

  $('[data-admin-tab-add]').addEventListener('click', () => {
    tabs = collectTabs();
    const id = `t${Date.now().toString(36)}`;
    tabs.push({ id, label: '' });
    renderTabList();
    root.querySelector(`[data-tab-id="${id}"] .admin-tab-label`).focus();
  });

  $('[data-admin-tabs-save]').addEventListener('click', async (e) => {
    const next = collectTabs();
    if (next.some((t) => !t.label)) return status('이름이 빈 분류가 있습니다.', true);
    await busy(e.currentTarget, async () => {
      try {
        tabs = (await post({ action: 'saveTabs', tabs: next })).tabs;
        updateConfig({ tabs: clone(tabs) });
        renderTabList();
        renderMenu();
        status('분류를 저장했습니다.');
      } catch (err) {
        status(failMsg(err), true);
      }
    });
  });

  // 옵션
  $('[data-admin-option-list]').addEventListener('click', (e) => {
    const card = e.target.closest('[data-option-key]');
    if (!card) return;
    const key = card.dataset.optionKey;
    options = collectOptions();
    if (e.target.closest('[data-choice-add]')) {
      options[key].choices.push({ label: '', note: '' });
    } else if (e.target.closest('[data-choice-remove]')) {
      options[key].choices.splice(Number(e.target.closest('[data-choice-remove]').dataset.choiceRemove), 1);
    } else if (e.target.closest('[data-option-delete]')) {
      const users = menu.filter((m) => m.option === key).map((m) => m.name);
      if (users.length) return status(`이 옵션을 쓰는 메뉴가 있어 삭제할 수 없습니다: ${users.join(', ')}`, true);
      if (!confirm(`'${options[key].name || '이름 없는 옵션'}'을(를) 삭제할까요? [옵션 저장]을 눌러야 반영됩니다.`)) return;
      delete options[key];
    } else {
      return;
    }
    renderOptions();
  });

  $('[data-admin-option-add]').addEventListener('click', () => {
    options = collectOptions();
    const key = `O${Date.now().toString(36).toUpperCase()}`;
    options[key] = { name: '', question: '', choices: [{ label: '', note: '' }] };
    renderOptions();
    root.querySelector(`[data-option-key="${key}"] [data-f="name"]`).focus();
  });

  $('[data-admin-options-save]').addEventListener('click', async (e) => {
    const next = collectOptions();
    Object.values(next).forEach((s) => { if (s.choices) s.choices = s.choices.filter((c) => c.label); });
    const problem = optionsProblem(next);
    if (problem) return status(problem, true);
    await busy(e.currentTarget, async () => {
      try {
        options = (await post({ action: 'saveOptions', options: next })).options;
        updateConfig({ options: clone(options) });
        renderOptions();
        status('옵션을 저장했습니다.');
      } catch (err) {
        status(failMsg(err), true);
      }
    });
  });

  // 예약 불가
  $('[data-admin-weekdays]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-weekday]');
    if (!b) return;
    toggle(blocked.weekdays, Number(b.dataset.weekday));
    renderBlocked();
  });

  $('[data-admin-times]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-time]');
    if (!b) return;
    toggle(blocked.times, b.dataset.time);
    renderBlocked();
  });

  $('[data-admin-date]').addEventListener('change', (e) => {
    dayKey = e.target.value || null;
    renderDay();
  });

  $('[data-admin-allday]').addEventListener('click', () => {
    toggle(blocked.dates, dayKey);
    renderBlocked();
  });

  $('[data-admin-day-times]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-day-time]');
    if (!b) return;
    blocked.slots[dayKey] = blocked.slots[dayKey] ?? [];
    toggle(blocked.slots[dayKey], b.dataset.dayTime);
    if (!blocked.slots[dayKey].length) delete blocked.slots[dayKey];
    renderBlocked();
  });

  $('[data-admin-dates]').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-date-edit]');
    if (edit) {
      dayKey = edit.dataset.dateEdit;
      $('[data-admin-date]').value = dayKey;
      renderDay();
      return;
    }
    const rm = e.target.closest('[data-date-remove]');
    if (!rm) return;
    const key = rm.dataset.dateRemove;
    blocked.dates = blocked.dates.filter((d) => d !== key);
    delete blocked.slots[key];
    renderBlocked();
  });

  $('[data-admin-blocked-save]').addEventListener('click', async (e) => {
    tidyBlocked();
    await busy(e.currentTarget, async () => {
      try {
        blocked = (await post({ action: 'saveBlocked', blocked })).blocked;
        updateConfig({ blocked: clone(blocked) });
        renderBlocked();
        status('예약 불가 설정을 저장했습니다.');
      } catch (err) {
        status(failMsg(err), true);
      }
    });
  });
}

// 이 탭에서 이미 로그인했으면 바로 들어감
export async function show() {
  if (password) return;
  let saved = null;
  try { saved = sessionStorage.getItem(PW_KEY); } catch {}
  if (!saved) return;
  try {
    await login(saved);
    await enter();
  } catch {
    try { sessionStorage.removeItem(PW_KEY); } catch {}
    status('');
  }
}
