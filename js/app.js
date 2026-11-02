// 해시 라우팅: #welcome · #menu · #schedule · #receipt · #guestbook
import * as welcome from './screens/welcome.js';
import * as menu from './screens/menu.js';
import * as schedule from './screens/schedule.js';
import * as receipt from './screens/receipt.js';
import * as guestbook from './screens/guestbook.js';
import * as admin from './screens/admin.js';
import { loadConfig } from './api.js';

// #admin은 링크 없이 주소로만 들어감
const screens = { welcome, menu, schedule, receipt, guestbook, admin };
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

loadConfig();
for (const [key, mod] of Object.entries(screens)) mod.init?.(els[key]);

// 시트에서 새 메뉴·예약 불가 설정이 오면 지금 화면을 다시 그림 (관리자 화면은 입력 중일 수 있어 제외)
window.addEventListener('config', () => {
  if (current && current !== 'admin') screens[current].show?.(els[current]);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-nav-back]')) return;
  if (history.state?.inApp) history.back();
  else location.hash = `#${PARENT[current] ?? DEFAULT}`;
});

window.addEventListener('hashchange', route);
route();
