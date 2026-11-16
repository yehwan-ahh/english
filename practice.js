const $ = (id) => document.getElementById(id);
let lessons = [], cat = "interview", qi = 0, ai = 0;
let words = [], placed = [], pool = [];

// ---------- 저장 (진도) — 막혀도 앱은 계속 동작
function getSaved() { try { return JSON.parse(localStorage.getItem("practice") || "{}"); } catch { return {}; } }
function save() { try { const s = getSaved(); s[cat] = { qi, ai }; s.cat = cat; localStorage.setItem("practice", JSON.stringify(s)); } catch {} }

// ---------- 소리
function speak(text) {
  if (!("speechSynthesis" in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US"; u.rate = 0.85;
  const v = speechSynthesis.getVoices().find((v) => v.lang === "en-US");
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

// ---------- 문장 다루기
const sentenceOf = (a) => a.blocks.join(" ");
function tileWord(w, i) {
  w = w.replace(/[.,!?]/g, "");
  // 첫 단어의 대문자가 정답을 알려주지 않도록 소문자로 (I, IT 같은 단어는 그대로)
  if (i === 0 && w !== "I" && w !== w.toUpperCase()) w = w[0].toLowerCase() + w.slice(1);
  return w;
}
const NUM = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten" };
const CONTR = { "i'll": "i will", "it's": "it is", "i'm": "i am", "what's": "what is", "we're": "we are", "you're": "you are", "don't": "do not", "can't": "cannot" };
function norm(text) {
  return text.toLowerCase().replace(/[’]/g, "'").replace(/p\.m\./g, "pm").replace(/a\.m\./g, "am")
    .replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean)
    .map((w) => NUM[w] || CONTR[w] || w).join(" ").split(" ");
}

// ---------- 화면
function current() { return lessons.filter((l) => l.cat === cat); }
function render() {
  const list = current();
  if (qi >= list.length) qi = 0;
  const L = list[qi];
  if (ai >= L.answers.length) ai = 0;
  const A = L.answers[ai];
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.cat === cat));
  $("progress").textContent = `질문 ${qi + 1} / ${list.length} · 답변 ${ai + 1} / ${L.answers.length}`;
  $("qEn").textContent = L.q;
  $("qKo").textContent = L.q_ko;
  $("aKo").textContent = A.ko;
  words = sentenceOf(A).split(" ").map(tileWord);
  placed = [];
  pool = words.map((w, i) => ({ w, id: i })).sort(() => Math.random() - 0.5);
  // 섞었는데 정답 순서 그대로면 한 번 더 섞기
  if (words.length > 1 && pool.every((p, i) => p.w === words[i])) pool.reverse();
  $("buildMsg").innerHTML = "";
  $("speakCard").hidden = true;
  $("heard").innerHTML = ""; $("speakMsg").innerHTML = "";
  drawTiles();
  save();
}
function drawTiles() {
  const slots = $("slots"), poolEl = $("pool");
  slots.innerHTML = ""; poolEl.innerHTML = "";
  slots.classList.remove("done");
  placed.forEach((p, i) => {
    const b = document.createElement("button");
    b.className = "tile" + (p.wrong ? " wrong" : "");
    b.textContent = p.w;
    b.onclick = () => {
      if ($("slots").classList.contains("done")) return; // 완성된 문장은 그대로
      pool.push(p); placed.splice(i, 1); placed.forEach((x) => (x.wrong = false));
      $("buildMsg").innerHTML = ""; drawTiles();
    };
    slots.appendChild(b);
  });
  if (!placed.length) slots.innerHTML = "<span class='muted'>아래 단어를 순서대로 눌러 보세요</span>";
  pool.forEach((p, i) => {
    const b = document.createElement("button");
    b.className = "tile"; b.textContent = p.w;
    b.onclick = () => { placed.push(pool.splice(i, 1)[0]); drawTiles(); if (!pool.length) check(); };
    poolEl.appendChild(b);
  });
}
function msg(el, cls, text) { $(el).innerHTML = ""; const d = document.createElement("div"); d.className = "msgline " + cls; d.textContent = text; $(el).appendChild(d); }

function check() {
  let wrongAt = -1;
  placed.forEach((p, i) => { p.wrong = p.w !== words[i]; if (p.wrong && wrongAt < 0) wrongAt = i; });
  if (wrongAt < 0) return success();
  const right = placed.filter((p) => !p.wrong).length;
  drawTiles();
  msg("buildMsg", "soft", `거의 다 왔어요! ${words.length}개 중 ${right}개가 제자리예요. 노란 단어를 눌러서 빼고 다시 놓아 보세요.`);
}
function success() {
  const L = current()[qi], A = L.answers[ai], s = sentenceOf(A);
  drawTiles();
  $("slots").classList.add("done");
  msg("buildMsg", "good", "🎉 완성! 문장을 혼자 조립했어요.");
  speak(s);
  $("target").textContent = s;
  $("chunks").innerHTML = "";
  A.blocks.forEach((b) => { const k = document.createElement("span"); k.className = "block"; k.textContent = b; $("chunks").appendChild(k); });
  $("speakCard").hidden = false;
  $("speakCard").scrollIntoView({ behavior: "smooth", block: "center" });
  // 복습 카드에 담기 (실패해도 연습은 계속)
  Store.add([{ en: s, ko: A.ko }]);
}
function hint() {
  // 틀린 단어는 돌려보내고, 다음 정답 단어 하나를 놓아 줘요
  for (let i = placed.length - 1; i >= 0; i--) if (placed[i].w !== words[i]) pool.push(...placed.splice(i));
  const need = words[placed.length];
  const k = pool.findIndex((p) => p.w === need);
  if (k >= 0) placed.push(pool.splice(k, 1)[0]);
  placed.forEach((x) => (x.wrong = false));
  drawTiles();
  if (!pool.length) check();
}
function next() {
  const L = current()[qi];
  ai++;
  if (ai >= L.answers.length) { ai = 0; qi = (qi + 1) % current().length; }
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
  speak(current()[qi].q);
}

// ---------- 말하기 채점 (브라우저 음성 인식)
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false;
function listen() {
  if (!SR) { $("micNotice").hidden = false; return; }
  if (listening) { rec.stop(); return; }
  speechSynthesis.cancel();
  rec = new SR();
  rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false;
  let finalText = "";
  rec.onresult = (ev) => {
    let t = "";
    for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
    finalText = t;
    $("heard").textContent = "🎧 " + t;
  };
  rec.onerror = (ev) => {
    if (ev.error === "not-allowed") msg("speakMsg", "soft", "마이크 권한이 막혀 있어요. 주소창 왼쪽 자물쇠 아이콘에서 마이크를 '허용'으로 바꿔 주세요.");
    else if (ev.error === "no-speech") msg("speakMsg", "soft", "소리가 안 들렸어요. 마이크 가까이에서 다시 말해 볼까요?");
  };
  rec.onend = () => {
    listening = false;
    $("micBtn").textContent = "🎙️ 다시 말하기";
    $("micBtn").classList.remove("on");
    if (finalText) grade(finalText);
  };
  rec.start();
  listening = true;
  $("micBtn").textContent = "⏹ 멈추기";
  $("micBtn").classList.add("on");
}
function grade(heardText) {
  const target = $("target").textContent;
  const heard = norm(heardText);
  const left = [...heard];
  const parts = target.split(" ").map((w) => {
    const ws = norm(w);
    const hit = ws.every((x) => { const k = left.indexOf(x); if (k >= 0) { left.splice(k, 1); return true; } return false; });
    return { w, hit };
  });
  const score = Math.round((parts.filter((p) => p.hit).length / parts.length) * 100);
  $("heard").innerHTML = "";
  parts.forEach((p) => { const s = document.createElement("span"); s.className = p.hit ? "hit" : "miss"; s.textContent = p.w + " "; $("heard").appendChild(s); });
  if (score >= 90) msg("speakMsg", "good", `✅ 완벽하게 통했어요! (${score}%) 다음 문장으로 가 볼까요?`);
  else if (score >= 60) msg("speakMsg", "good", `✅ 잘 통했어요! (${score}%) 회색 단어만 🔊로 한 번 듣고 다시 말해 보면 더 좋아요.`);
  else msg("speakMsg", "soft", `👍 좋은 시도예요! (${score}%) 🔊로 먼저 듣고, 덩어리별로 천천히 따라 말해 보세요.`);
}

// ---------- 시작
document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => {
  cat = t.dataset.cat;
  const s = getSaved()[cat] || {};
  qi = s.qi || 0; ai = s.ai || 0;
  render();
}));
$("qPlay").onclick = () => speak(current()[qi].q);
$("tPlay").onclick = () => speak($("target").textContent);
$("hintBtn").onclick = hint;
$("resetBtn").onclick = () => { pool.push(...placed.splice(0)); placed.forEach((x) => (x.wrong = false)); pool.forEach((x) => (x.wrong = false)); drawTiles(); $("buildMsg").innerHTML = ""; };
$("nextBtn").onclick = next;
$("micBtn").onclick = listen;
if (!SR) $("micNotice").hidden = false;

lessons = window.LESSONS;
{
  const s = getSaved();
  cat = s.cat || "interview";
  qi = (s[cat] || {}).qi || 0; ai = (s[cat] || {}).ai || 0;
  render();
}
