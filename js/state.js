// cart · schedule · pledge 상태 + localStorage 저장
const KEY = '304-state';
export const CART_MAX = 6;

const initial = () => ({
  cart: [], // [{ id, option }] — option: 고른 라벨 또는 자유 입력 문장, 없으면 null
  schedule: { date: null, time: null, party: null },
  pledge: false,
  receiptNo: null,
});

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && Array.isArray(saved.cart)) return { ...initial(), ...saved };
  } catch {}
  return initial();
}

export const state = load();

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  listeners.forEach((fn) => fn(state));
}

export function update(patch) {
  Object.assign(state, patch);
  commit();
}

export function setSchedule(patch) {
  state.schedule = { ...state.schedule, ...patch };
  commit();
}

export function isScheduleComplete() {
  const { date, time, party } = state.schedule;
  return Boolean(date && time && party);
}

export function inCart(id) {
  return state.cart.some((item) => item.id === id);
}

export function addToCart(id, option = null) {
  if (inCart(id) || state.cart.length >= CART_MAX) return false;
  state.cart.push({ id, option });
  commit();
  return true;
}

export function removeFromCart(id) {
  state.cart = state.cart.filter((item) => item.id !== id);
  commit();
}

export function setCart(items) {
  state.cart = items.slice(0, CART_MAX);
  commit();
}
