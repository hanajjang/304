// #welcome — 오마카세 버튼은 cart를 [오마카세]로 세팅 후 #schedule로
import { setCart } from '../state.js';

const PRESS_MS = 180; // 눌린 색을 잠깐 보여 준 뒤 이동

export function init(el) {
  el.querySelector('[data-omakase]').addEventListener('click', () => {
    setCart([{ id: 'oma', option: null }]);
  });

  el.querySelector('.dock').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-choice');
    if (!btn || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    btn.classList.add('is-pressed');
    setTimeout(() => { location.hash = btn.getAttribute('href'); }, PRESS_MS);
  });
}

// 돌아왔을 때 눌림 표시 지우기
export function show(el) {
  el.querySelectorAll('.is-pressed').forEach((b) => b.classList.remove('is-pressed'));
}
