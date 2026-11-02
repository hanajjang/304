// #guestbook — 별점·한 줄 품평 폼, 엽서 그리드
import { SEED_REVIEWS, REVIEWS_API_URL } from '../data.js';

const DEFAULT_NAME = '익명의 귀빈';

// ---------- 저장소: Apps Script 웹 앱 주소가 있으면 공유 시트, 없으면 이 브라우저 ----------
const KEY = '304-reviews';

const localStore = {
  async list() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) ?? [];
    } catch {
      return [];
    }
  },
  async add(review) {
    const mine = await this.list();
    localStorage.setItem(KEY, JSON.stringify([{ ...review, id: `r-${Date.now()}`, at: Date.now() }, ...mine]));
  },
};

// text/plain으로 보내야 Apps Script가 CORS 사전 요청 없이 받음
const sheetStore = {
  async list() {
    const res = await fetch(REVIEWS_API_URL);
    const data = await res.json();
    if (!data.ok) throw new Error('list failed');
    return data.reviews;
  },
  async add(review) {
    const res = await fetch(REVIEWS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(review),
    });
    const data = await res.json();
    if (!data.ok) throw new Error('add failed');
  },
};

const store = REVIEWS_API_URL ? sheetStore : localStore;

let root;
let rating = 0;

// id에서 정해지는 기울기 (±2.5°) — 다시 그려도 엽서가 흔들리지 않게
function tilt(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 51) / 10 - 2.5).toFixed(1);
}

function postcardEl(review) {
  const li = document.createElement('li');
  li.className = 'postcard';
  li.style.setProperty('--tilt', `${tilt(review.id)}deg`);
  li.innerHTML = `
    <span class="postcard-tape" aria-hidden="true"></span>
    <p class="postcard-stars"><span aria-hidden="true">${
      '<span class="on">★</span>'.repeat(review.rating) + '★'.repeat(5 - review.rating)
    }</span><span class="sr-only">별 ${review.rating}개</span></p>
    <p class="postcard-text"></p>
    <p class="postcard-name"></p>`;
  li.querySelector('.postcard-text').textContent = review.text;
  li.querySelector('.postcard-name').textContent = `— ${review.name}`;
  return li;
}

async function render() {
  let saved = [];
  try {
    saved = await store.list();
  } catch {}
  const reviews = [...saved, ...SEED_REVIEWS].sort((a, b) => b.at - a.at);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  root.querySelector('[data-gb-avg]').textContent = avg.toFixed(1);
  root.querySelector('[data-gb-count]').textContent = reviews.length;
  root.querySelector('[data-gb-list]').replaceChildren(...reviews.map(postcardEl));
}

function syncForm() {
  const form = root.querySelector('[data-gb-form]');
  form.querySelectorAll('[data-star]').forEach((s) => {
    s.setAttribute('aria-pressed', String(Number(s.dataset.star) <= rating));
  });
  form.querySelector('[type="submit"]').disabled = !(rating && form.elements.text.value.trim());
}

export function init(el) {
  root = el;
  const form = el.querySelector('[data-gb-form]');

  form.querySelector('.stars').addEventListener('click', (e) => {
    const star = e.target.closest('[data-star]');
    if (!star) return;
    rating = Number(star.dataset.star);
    syncForm();
  });

  form.elements.text.addEventListener('input', syncForm);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = form.elements.text.value.trim();
    if (!rating || !text) return;
    const submit = form.querySelector('[type="submit"]');
    const error = form.querySelector('[data-gb-error]');
    submit.disabled = true;
    error.hidden = true;
    try {
      await store.add({ rating, text, name: form.elements.name.value.trim() || DEFAULT_NAME });
    } catch {
      error.hidden = false;
      syncForm();
      return;
    }
    form.reset();
    rating = 0;
    syncForm();
    render();
  });

  syncForm();
}

export function show() {
  render();
}
