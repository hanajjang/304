// 해시 라우팅: #welcome · #menu · #schedule · #receipt · #guestbook
import * as welcome from './screens/welcome.js';
import * as menu from './screens/menu.js';
import * as schedule from './screens/schedule.js';
import * as receipt from './screens/receipt.js';
import * as guestbook from './screens/guestbook.js';

const screens = { welcome, menu, schedule, receipt, guestbook };
const DEFAULT = 'welcome';
// 뒤로 갈 기록이 없을 때(링크로 바로 들어온 경우) 흐름상 앞 단계
const PARENT = { menu: 'welcome', schedule: 'menu', receipt: 'schedule', guestbook: 'welcome' };

const els = {};
document.querySelectorAll('[data-screen]').forEach((el) => {
  els[el.dataset.screen] = el;
});

let current = null;

function route() {
  const name = location.hash.slice(1);
  if (!(name in screens)) {
    history.replaceState(null, '', `#${DEFAULT}`);
    return route();
  }

  for (const [key, el] of Object.entries(els)) el.hidden = key !== name;
  window.scrollTo(0, 0);

  // 첫 진입이 아니면 화면 제목으로 포커스 이동 (스크린리더 안내)
  // + 앱 안에서 넘어온 기록임을 표시 → 뒤로 버튼이 history.back()을 써도 사이트 밖으로 나가지 않음
  if (current !== null) {
    if (!history.state?.inApp) history.replaceState({ inApp: true }, '');
    els[name].querySelector('h1')?.focus({ preventScroll: true });
  }
  current = name;

  screens[name].show?.(els[name]);
}

for (const [key, mod] of Object.entries(screens)) mod.init?.(els[key]);

document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-nav-back]')) return;
  if (history.state?.inApp) history.back();
  else location.hash = `#${PARENT[current] ?? DEFAULT}`;
});

window.addEventListener('hashchange', route);
route();
