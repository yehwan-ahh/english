// 오프라인용 — 한 번 열면 파일을 폰에 저장해 두고, 인터넷이 없어도(지하철) 열려요.
const CACHE = "eng-v1";
const FILES = [
  "./", "index.html", "review.html", "ai.html", "style.css",
  "practice.js", "app.js", "gpt.js", "store.js", "lessons.js", "seed.js",
  "manifest.json", "icon.svg", "pwa.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// 저장해 둔 걸 먼저 보여주고, 인터넷이 되면 뒤에서 새 버전으로 갱신
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // OpenAI 호출 등은 그대로
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(e.request, { ignoreSearch: true });
      const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })
  );
});
