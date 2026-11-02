# 304호 — 집밥 초대 메뉴판·예약 웹앱

상세 명세는 `SPEC.md`. 작업 전 해당 섹션만 읽을 것(전체 재독 금지).

## 스택 (고정)
- 정적 사이트: HTML + CSS + 바닐라 JS(ES 모듈). 프레임워크·빌드 도구·백엔드 없음.
- 배포: GitHub Pages. 외부 의존은 Google Fonts, Kakao JS SDK(선택)뿐.
- 모바일 우선 390×844 기준, 최대 폭 430px 중앙 정렬.

## 파일 구조
```
index.html        # 단일 페이지, 화면은 <section data-screen="..."> 5개
css/tokens.css    # 색·폰트·간격 토큰
css/app.css
js/data.js        # 메뉴·옵션·문구 (데이터만)
js/state.js       # cart, schedule, pledge 상태 + localStorage 저장
js/screens/*.js   # welcome, menu, schedule, receipt, guestbook 각 1파일
js/app.js         # 라우팅(hash: #welcome …)
assets/food/      # 음식 일러스트(svg/png), 없으면 SPEC의 임시 SVG 칩
```

## 작업 규칙
- 한 번에 한 Phase만. 끝나면 변경 파일 목록 + 확인 방법 3줄로 보고하고 멈춤.
- 기존 동작을 바꾸는 수정은 먼저 이유를 설명하고 승인받기.
- 문구(집사 말투)는 SPEC.md 그대로. 임의로 새 문구 만들지 말 것. 없으면 `[문구 필요]` 표기.
- 색·폰트는 tokens.css 변수만 사용. 하드코딩 금지.
- 접근성: 버튼은 `<button>`/`<a>`, 터치 영역 ≥44px, 아이콘 버튼 aria-label.
- 파일 전체 재작성보다 부분 수정 우선. 이미 읽은 파일은 다시 읽지 않기.
