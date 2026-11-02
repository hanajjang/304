// 메뉴·옵션·문구 데이터 (SPEC 5절)

export const OPTION_SETS = {
  RICE: {
    name: '밥 양',
    question: '아가씨, 고봉밥을 하사받으시겠습니까, 아니면 품위를 지키는 소식 모드로 가시겠습니까?',
    choices: [
      { label: '보통', note: '아가씨의 품격에 어울리는 정량' },
      { label: '고봉밥', note: '체면을 내려놓고 탄수화물 폭주 (집사 한숨 1회 적립)' },
      { label: '소식', note: '새 모이만큼 드실 거면 왜 오셨습니까?' },
    ],
  },
  SPICY: {
    name: '맵기',
    question: '맵기는 어느 쪽 체통으로 모시겠습니까?',
    choices: [
      { label: '맵찔이 모드', note: '품위 있는 순한 맛' },
      { label: '보통', note: '집사가 권하는 정석' },
      { label: '매운맛 극락 모드', note: '눈물을 흘리셔도 집사는 모른 척합니다' },
    ],
  },
  UKU: {
    name: '관람 태도',
    question: '연주에 임하는 태도를 미리 서약해 주십시오.',
    choices: [
      { label: '기립박수 준비 완료', note: '앙코르 연호까지 가능' },
      { label: '조용히 경청', note: '숨소리마저 아름다울 것입니다' },
    ],
  },
  // 자유 입력 1줄 (기타 메뉴)
  FREE: {
    name: '[문구 필요]',
    question: '[문구 필요]',
    free: true,
  },
};

// c1 = 임시 SVG 칩 메인색, c2 = 포인트색 (tokens.css의 --food-*)
export const MENU = [
  { id: 'omu', tab: 'egg', name: '수제 오므라이스', short: '오므라이스', desc: '시판 소스도 있었으나 제 완벽주의가 용납지 않아 직접 졸였습니다. 사진은 3초 안에.', bill: '격한 감탄사 5회', option: 'RICE', c1: '--food-yolk', c2: '--food-ketchup' },
  { id: 'fry', tab: 'egg', name: '계란 후라이', short: '후라이', desc: '반숙과 완숙 사이, 제가 정한 정답으로 올려드립니다.', bill: '박수 1회', option: null, c1: '--food-eggwhite', c2: '--food-yolk' },
  { id: 'steam', tab: 'egg', name: '계란찜', short: '계란찜', desc: '뚝배기 위로 봉긋하게. 숟가락질에도 품위가 필요합니다.', bill: '숟가락 건네기', option: null, c1: '--food-custard', c2: '--food-scallion' },
  { id: 'roll', tab: 'egg', name: '계란말이', short: '계란말이', desc: '겹겹이 말아 단정히 썰었습니다. 케첩은 허락하지 않겠습니다.', bill: '진심 어린 리액션 3회', option: null, c1: '--food-yolk', c2: '--food-scallion' },
  { id: 'soy', tab: 'egg', name: '간장계란밥', short: '간장계란밥', desc: '소박하다 비웃지 마십시오. 참기름 한 방울에 체통이 걸려 있습니다.', bill: '뒷정리 5분', option: 'RICE', c1: '--food-rice', c2: '--food-soy' },
  { id: 'galchi', tab: 'rice', name: '갈치솥밥', short: '갈치솥밥', desc: '순살만 발라 지었으니 나머지는 알아서 하십시오. (제주 은갈치·쪽파·버터)', bill: '격한 감탄사 5회', option: 'RICE', c1: '--food-rice', c2: '--food-silver' },
  { id: 'mush', tab: 'rice', name: '버섯솥밥', short: '버섯솥밥', desc: '숲의 향을 솥째 모셨습니다. 뚜껑은 제가 열 때까지 기다리십시오. (제철 버섯·양념장)', bill: '감탄사 3회', option: 'RICE', c1: '--food-rice', c2: '--food-mushroom' },
  { id: 'eggp', tab: 'rice', name: '가지솥밥', short: '가지솥밥', desc: '가지가 싫다는 말씀은 접수하지 않습니다. 드셔 보시고 판단하십시오. (구운 가지·들기름)', bill: '솔직한 후기 1회', option: 'RICE', c1: '--food-rice', c2: '--food-eggplant' },
  { id: 'kkak', tab: 'wok', name: '깍두기 볶음밥', short: '깍두기볶음밥', desc: '묵은 깍두기를 철판 위에서 재해석했습니다. (깍두기·계란·참기름)', bill: '박수 2회', option: 'SPICY', c1: '--food-kimchi', c2: '--food-yolk' },
  { id: 'kim', tab: 'wok', name: '김치볶음밥', short: '김치볶음밥', desc: '정석이 가장 어렵다는 것을 곧 아시게 될 것입니다. (잘 익은 김치·후라이 고명)', bill: '박수 2회', option: 'SPICY', c1: '--food-kimchi', c2: '--food-eggwhite' },
  { id: 'ramen', tab: 'wok', name: '라면', short: '라면', desc: '이 저택에서 인스턴트를 청하시다니 대담하십니다. 하지만 제가 끓이면 다릅니다. (파·계란 추가 가능)', bill: '설거지 보조 10분', option: 'SPICY', c1: '--food-noodle', c2: '--food-kimchi' },
  { id: 'jja', tab: 'wok', name: '짜장라면', short: '짜장라면', desc: '대저택의 비밀 레시피로 졸여낸 검은 연회면. (오이 채·계란후라이 추가 가능)', bill: '설거지 및 뒷정리 풀코스', option: null, c1: '--food-jjajang', c2: '--food-scallion' },
  { id: 'yog', tab: 'dessert', name: '요거트 모찌', short: '요거트 모찌', desc: '새콤한 반죽 속에 부드러움을 숨겼습니다. 한 입에 드시지 마십시오.', bill: '박수 1회', option: null, c1: '--food-mochi', c2: '--food-berry' },
  { id: 'red', tab: 'dessert', name: '단팥 모찌', short: '단팥 모찌', desc: '직접 졸인 단팥을 품은 쫀득한 한입. 체통을 지키며 삼키십시오.', bill: '박수 1회', option: null, c1: '--food-mochi', c2: '--food-redbean' },
  { id: 'fruit', tab: 'dessert', name: '제철 과일', short: '제철 과일', desc: '오늘의 과일은 시장 사정에 따라 집사가 정합니다. 불만은 접수하지 않습니다.', bill: '과일 사오기', option: null, c1: '--food-berry', c2: '--food-scallion' },
  { id: 'oma', tab: 'secret', name: '제철 요리 오마카세', short: '오마카세', desc: '헤드 셰프의 변덕에 전적으로 맡기는 코스. 메뉴는 도착해야 아십니다.', bill: '전적인 신뢰와 빈손 금지', option: null, c1: '--pewter-lo', c2: '--food-yolk' },
  { id: 'etc', tab: 'secret', name: '기타 : 먹고싶은 것', short: '먹고싶은 것', desc: '메뉴판에 없는 것을 청하시다니. 접수는 하되 가부는 심사 후 통보드립니다.', bill: '정중한 부탁 1회', option: 'FREE', c1: '--line-soft', c2: '--script' },
  { id: 'uku', tab: 'secret', name: '수석 집사의 독점 4현 리사이틀', short: '4현 리사이틀', desc: '경청 및 기립박수 필수. 연주 중 핸드폰을 보시면 즉시 퇴장 조치됩니다. 앙코르는 집사의 컨디션에 따라 기각될 수 있습니다.', bill: '중간 박수 2회 및 앙코르 연호', option: 'UKU', c1: '--food-wood', c2: '--ink' },
];

export const MENU_BY_ID = Object.fromEntries(MENU.map((m) => [m.id, m]));

export const PARTY = { 1: '아가씨 1인', 2: '아가씨 외 1인' };

// Kakao JavaScript 키 — 비어 있으면 SDK 없이 kakaotalk:// 열기만 시도
export const KAKAO_JS_KEY = '';

// 품평록 공유 시트: Apps Script 웹 앱 주소(…/exec) — 비어 있으면 이 브라우저(localStorage)에만 저장
export const REVIEWS_API_URL = 'https://script.google.com/macros/s/AKfycbyx9YJRaf5Kc1kNFjGBFzrerA_4OLGMZttaDS7SSbDCIj5rn5I-7SQWLYWe7FCzxSbA1g/exec';

// 방명록 시드 3개 — 문구·별점은 SPEC에 없어 자리만 잡아 둠
export const SEED_REVIEWS = [
  { id: 'seed-1', rating: 5, text: '맛있어요~최고야', name: 'hana', at: 3 },
  { id: 'seed-2', rating: 5, text: '[문구 필요]', name: '익명의 귀빈', at: 2 },
  { id: 'seed-3', rating: 5, text: '[문구 필요]', name: '익명의 귀빈', at: 1 },
];
