// #welcome — 오마카세 버튼은 cart를 [오마카세]로 세팅 후 #schedule로
import { setCart } from '../state.js';

export function init(el) {
  el.querySelector('[data-omakase]').addEventListener('click', () => {
    setCart([{ id: 'oma', option: null }]);
  });
}

export function show(el) {}
