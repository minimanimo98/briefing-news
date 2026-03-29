const CACHE_NAME = 'etfradar-v3';

// 앱 껍데기(shell)만 캐시 — 뉴스는 항상 네트워크 우선
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/board.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700;900&family=Noto+Sans+KR:wght@300;400;500;700&display=swap'
];

/* ── 설치: static assets 캐시 ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

/* ── 활성화: 이전 캐시 삭제 ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── fetch 전략 ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // RSS API → 항상 네트워크 (뉴스 최신성 유지)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 외부 리소스(Google News, Fonts 등) → 네트워크 우선, 실패 시 캐시
  if (url.origin !== location.origin) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 내부 페이지 → 네트워크 우선, 실패 시 캐시 (오프라인 지원)
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
