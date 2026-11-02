// #menu — 탭, 메뉴 카드, 옵션 시트, 은쟁반
import { MENU, MENU_BY_ID, OPTION_SETS } from '../data.js';
import { state, subscribe, inCart, addToCart, removeFromCart, CART_MAX } from '../state.js';

// 접시 중심 좌표(330×178 쟁반 기준 px), 개수별 — 좁은 화면에서 쟁반이 줄면 비율로 따라감
const TRAY_W = 330;
const TRAY_H = 178;
const SLOTS = {
  1: [[165, 89]],
  2: [[105, 89], [225, 89]],
  3: [[75, 89], [165, 89], [255, 89]],
  4: [[115, 56], [215, 56], [115, 124], [215, 124]],
  5: [[85, 56], [165, 56], [245, 56], [125, 124], [205, 124]],
  6: [[85, 56], [165, 56], [245, 56], [85, 124], [165, 124], [245, 124]],
};

let root;
let activeTab = 'egg';
let justAdded = null;
const missingImages = new Set();

// ---------- 음식 이미지: assets/food/{id}.png, 없으면 임시 SVG 칩 ----------
function chip(item) {
  const wrap = document.createElement('span');
  wrap.className = 'food-art food-chip';
  wrap.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">
    <ellipse class="chip-plate" cx="50" cy="52" rx="46" ry="38"/>
    <ellipse cx="50" cy="51" rx="30" ry="23" style="fill: var(${item.c1})"/>
    <circle cx="40" cy="45" r="6" style="fill: var(${item.c2})"/>
    <circle cx="59" cy="56" r="4.5" style="fill: var(${item.c2})"/>
    <circle cx="61" cy="41" r="3" style="fill: var(${item.c2})"/>
  </svg>`;
  return wrap;
}

function foodImage(item) {
  if (missingImages.has(item.id)) return chip(item);
  const img = document.createElement('img');
  img.className = 'food-art';
  img.alt = '';
  img.src = `assets/food/${item.id}.png`;
  img.addEventListener('error', () => {
    missingImages.add(item.id);
    img.replaceWith(chip(item));
  }, { once: true });
  return img;
}

// ---------- 메뉴 카드 ----------
function splitDesc(desc) {
  const m = desc.match(/^(.*?)\s*(\([^)]*\))$/);
  return m ? [m[1], m[2]] : [desc, ''];
}

function cardEl(item) {
  const [line, ingredients] = splitDesc(item.desc);
  const li = document.createElement('li');
  li.className = 'menu-card';

  const thumb = document.createElement('div');
  thumb.className = 'menu-thumb';
  thumb.append(foodImage(item));

  const info = document.createElement('div');
  info.className = 'menu-info';
  info.innerHTML = `
    <h3 class="menu-name" id="menu-${item.id}"></h3>
    <p class="menu-desc"></p>
    <p class="menu-bill"></p>
    <button class="btn btn-xs" type="button" data-pick="${item.id}" aria-describedby="menu-${item.id}"></button>`;
  info.querySelector('.menu-name').textContent = item.name;
  info.querySelector('.menu-desc').textContent = line;
  if (ingredients) {
    const span = document.createElement('span');
    span.className = 'menu-ingredients';
    span.textContent = ingredients;
    info.querySelector('.menu-desc').append(span);
  }
  info.querySelector('.menu-bill').textContent = `청구 · ${item.bill}`;

  li.append(thumb, info);
  return li;
}

function renderList() {
  const list = root.querySelector('[data-menu-list]');
  list.replaceChildren(...MENU.filter((m) => m.tab === activeTab).map(cardEl));
  syncButtons();
}

function syncButtons() {
  const full = state.cart.length >= CART_MAX;
  root.querySelectorAll('[data-pick]').forEach((btn) => {
    const picked = inCart(btn.dataset.pick);
    btn.classList.toggle('btn-primary', !picked && !full);
    btn.disabled = !picked && full;
    btn.textContent = picked ? '허락 철회' : full ? '쟁반 만석' : '내 만찬에 허락하기';
  });
  root.querySelector('[data-to-schedule]').disabled = state.cart.length === 0;
}

// ---------- 은쟁반 ----------
// 접시를 누르면 그 메뉴를 물림
function plateEl(item) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'plate';
  el.dataset.id = item.id;
  el.setAttribute('aria-label', `${item.short} 물리기`);
  const body = document.createElement('div');
  body.className = 'plate-body';
  body.append(foodImage(item));
  body.insertAdjacentHTML('beforeend', `
    <svg class="plate-cloche" viewBox="0 0 48 36" aria-hidden="true">
      <path d="M4 32 C4 15 13 8 24 8 C35 8 44 15 44 32 Z"/>
      <circle cx="24" cy="5" r="3"/>
    </svg>
    <span class="plate-steam" aria-hidden="true"><i></i><i></i><i></i></span>`);
  const name = document.createElement('span');
  name.className = 'plate-name';
  name.textContent = item.short;
  el.append(body, name);
  return el;
}

// 물린 접시는 사라지는 모션 뒤 제거 (동작 줄이기·숨은 화면이면 바로)
function leave(el) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || root.hidden) return el.remove();
  el.classList.add('is-leaving');
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

function renderTray() {
  const cart = state.cart.filter((c) => MENU_BY_ID[c.id]);
  const plates = root.querySelector('[data-tray-plates]');
  const slots = SLOTS[cart.length] ?? [];
  const existing = new Map(
    [...plates.children].filter((el) => !el.classList.contains('is-leaving')).map((el) => [el.dataset.id, el]),
  );

  cart.forEach((c, i) => {
    let el = existing.get(c.id);
    if (el) {
      existing.delete(c.id);
    } else {
      el = plateEl(MENU_BY_ID[c.id]);
      if (c.id === justAdded) el.classList.add('is-new');
      plates.append(el);
    }
    el.style.left = `${(slots[i][0] / TRAY_W) * 100}%`;
    el.style.top = `${(slots[i][1] / TRAY_H) * 100}%`;
  });
  existing.forEach(leave);
  justAdded = null;

  root.querySelector('[data-tray-badge]').textContent =
    cart.length >= CART_MAX ? '쟁반 만석' : `만찬 ${cart.length}품`;
  root.querySelector('[data-tray-empty]').hidden = cart.length > 0;
}

// ---------- 옵션 시트 ----------
const sheet = { item: null, choice: null, trigger: null };

function openSheet(item, trigger) {
  const set = OPTION_SETS[item.option];
  const el = root.querySelector('[data-sheet]');
  const options = el.querySelector('[data-sheet-options]');
  const confirm = el.querySelector('[data-sheet-confirm]');
  Object.assign(sheet, { item, choice: null, trigger });

  el.querySelector('[data-sheet-kicker]').textContent = `${set.name} 심의`;
  el.querySelector('[data-sheet-name]').textContent = item.name;
  el.querySelector('[data-sheet-question]').textContent = set.question;
  confirm.disabled = true;

  if (set.free) {
    const input = document.createElement('input');
    input.className = 'field';
    input.type = 'text';
    input.maxLength = 40;
    input.setAttribute('aria-label', item.name);
    input.addEventListener('input', () => {
      sheet.choice = input.value.trim() || null;
      confirm.disabled = !sheet.choice;
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && sheet.choice) confirmSheet();
    });
    options.replaceChildren(input);
  } else {
    options.replaceChildren(...set.choices.map((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'opt';
      btn.setAttribute('aria-pressed', 'false');
      btn.dataset.choice = c.label;
      btn.innerHTML = '<span class="opt-label"></span><span class="opt-note"></span>';
      btn.querySelector('.opt-label').textContent = c.label;
      btn.querySelector('.opt-note').textContent = c.note;
      return btn;
    }));
  }

  root.querySelector('[data-sheet-backdrop]').hidden = false;
  el.hidden = false;
  options.querySelector('button, input').focus();
}

function closeSheet() {
  root.querySelector('[data-sheet]').hidden = true;
  root.querySelector('[data-sheet-backdrop]').hidden = true;
  sheet.trigger?.focus();
  Object.assign(sheet, { item: null, choice: null, trigger: null });
}

function confirmSheet() {
  justAdded = sheet.item.id;
  addToCart(sheet.item.id, sheet.choice);
  closeSheet();
}

// ---------- 화면 ----------
export function init(el) {
  root = el;

  el.querySelector('.tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;
    activeTab = tab.dataset.tab;
    el.querySelectorAll('[data-tab]').forEach((t) => t.setAttribute('aria-pressed', String(t === tab)));
    renderList();
  });

  el.querySelector('[data-tray-plates]').addEventListener('click', (e) => {
    const plate = e.target.closest('.plate');
    if (!plate) return;
    removeFromCart(plate.dataset.id);
    el.querySelector('[data-tray]').focus({ preventScroll: true });
  });

  el.querySelector('[data-menu-list]').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick]');
    if (!btn) return;
    const item = MENU_BY_ID[btn.dataset.pick];
    if (inCart(item.id)) {
      removeFromCart(item.id);
    } else if (item.option) {
      openSheet(item, btn);
    } else {
      justAdded = item.id;
      addToCart(item.id);
    }
  });

  const sheetEl = el.querySelector('[data-sheet]');
  sheetEl.querySelector('[data-sheet-options]').addEventListener('click', (e) => {
    const opt = e.target.closest('[data-choice]');
    if (!opt) return;
    sheet.choice = opt.dataset.choice;
    sheetEl.querySelectorAll('[data-choice]').forEach((b) => b.setAttribute('aria-pressed', String(b === opt)));
    sheetEl.querySelector('[data-sheet-confirm]').disabled = false;
  });
  sheetEl.querySelector('[data-sheet-cancel]').addEventListener('click', closeSheet);
  sheetEl.querySelector('[data-sheet-confirm]').addEventListener('click', confirmSheet);
  sheetEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return closeSheet();
    if (e.key !== 'Tab') return;
    // 시트 안에서만 포커스 순환
    const focusables = [...sheetEl.querySelectorAll('button:not(:disabled), input')];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  el.querySelector('[data-sheet-backdrop]').addEventListener('click', closeSheet);

  el.querySelector('[data-to-schedule]').addEventListener('click', () => {
    location.hash = '#schedule';
  });

  subscribe(() => {
    syncButtons();
    renderTray();
  });

  renderList();
  renderTray();
}

export function show() {
  syncButtons();
  renderTray();
}
