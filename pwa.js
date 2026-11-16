// 인터넷 주소(https)로 열었을 때만 오프라인 저장을 켜요. 파일로 열면 그냥 넘어가요.
(function () {
  const head = document.head;
  const add = (tag, attrs) => { const e = document.createElement(tag); Object.assign(e, attrs); head.appendChild(e); };
  add("link", { rel: "manifest", href: "manifest.json" });
  add("link", { rel: "icon", href: "icon.svg", type: "image/svg+xml" });
  add("link", { rel: "apple-touch-icon", href: "icon.svg" });
  add("meta", { name: "theme-color", content: "#2f6fde" });
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
