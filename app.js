const $ = (id) => document.getElementById(id);
const chatEl = $("chat");
const input = $("input");
let history = [];
let busy = false;

// ---------- 공통: 소리로 읽기 (브라우저 내장 TTS)
function speak(text) {
  if (!("speechSynthesis" in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.9;
  const v = speechSynthesis.getVoices().find((v) => v.lang === "en-US");
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}
function playBtn(text) {
  const b = document.createElement("button");
  b.className = "play"; b.textContent = "🔊"; b.title = "듣기";
  b.onclick = () => speak(text);
  return b;
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

async function api(path, body) {
  if (path === "/api/chat") return GPT.chat(body.mode, body.history);
  if (path === "/api/help") return GPT.help(body.text);
}

// ---------- 화면에 말풍선 그리기
function addMe(text) {
  const m = el("div", "msg me");
  m.appendChild(el("div", "bubble en", text));
  chatEl.appendChild(m);
  return m;
}
function addAI(res, meMsg) {
  if (meMsg && res.understood_ko) meMsg.appendChild(el("div", "ok", "✅ " + res.understood_ko));
  if (meMsg && res.natural_en) {
    const b = el("div", "better");
    const line = el("div", "en", "💡 " + res.natural_en);
    line.appendChild(playBtn(res.natural_en));
    b.appendChild(line);
    if (res.natural_note_ko) b.appendChild(el("div", "ko", res.natural_note_ko));
    meMsg.appendChild(b);
  }
  const m = el("div", "msg ai");
  const bub = el("div", "bubble");
  const en = el("div", "en", res.reply_en);
  en.appendChild(playBtn(res.reply_en));
  bub.appendChild(en);
  bub.appendChild(el("div", "ko", res.reply_ko));
  if (res.hint_en) bub.appendChild(el("div", "hint", "🪜 이렇게 시작해 보세요: " + res.hint_en));
  if (res.added) bub.appendChild(el("div", "saved", `📌 표현 ${res.added}개를 복습에 담았어요`));
  m.appendChild(bub);
  chatEl.appendChild(m);
  m.scrollIntoView({ behavior: "smooth", block: "end" });
  if ($("autoSpeak").checked) speak(res.reply_en);
}
function addError(msg) {
  const m = el("div", "card notice", "⚠️ " + msg);
  chatEl.appendChild(m);
  m.scrollIntoView({ behavior: "smooth" });
}
function thinking(on) {
  busy = on;
  $("sendBtn").disabled = on; $("startBtn").disabled = on;
  let t = $("thinking");
  if (on && !t) { t = el("p", "muted", "생각하는 중…"); t.id = "thinking"; chatEl.appendChild(t); }
  if (!on && t) t.remove();
}

// ---------- 대화
async function start() {
  if (busy) return;
  history = [];
  chatEl.innerHTML = "";
  thinking(true);
  try {
    const res = await api("/api/chat", { mode: $("mode").value, history: [] });
    history.push({ role: "ai", text: res.reply_en });
    thinking(false);
    addAI(res, null);
  } catch (e) { thinking(false); addError(e.message); }
}

async function send() {
  const text = input.value.trim();
  if (!text || busy) return;
  stopMic();
  if (!history.length) { await start(); if (!history.length) return; }
  input.value = "";
  const meMsg = addMe(text);
  history.push({ role: "me", text });
  thinking(true);
  try {
    const res = await api("/api/chat", { mode: $("mode").value, history });
    history.push({ role: "ai", text: res.reply_en });
    thinking(false);
    addAI(res, meMsg);
  } catch (e) {
    thinking(false);
    history.pop();
    input.value = text;
    addError(e.message);
  }
}

// ---------- 한국어 → 영어 조립 도우미
async function help() {
  const text = $("helpText").value.trim();
  if (!text) return;
  const out = $("helpOut");
  out.innerHTML = "<p class='muted'>조립하는 중…</p>";
  try {
    const r = await api("/api/help", { text });
    out.innerHTML = "";
    const line = el("div", "en", r.sentence_en);
    line.style.marginTop = "12px";
    line.appendChild(playBtn(r.sentence_en));
    out.appendChild(line);
    const blocks = el("div", "blocks");
    r.blocks.forEach((b) => {
      const k = el("span", "block", b.en);
      k.appendChild(el("small", null, b.ko));
      blocks.appendChild(k);
    });
    out.appendChild(blocks);
    out.appendChild(el("p", "muted", "💬 " + r.tip_ko));
    const use = el("button", null, "이 문장으로 말해 보기 ↓");
    use.onclick = () => { input.value = ""; input.placeholder = "따라 말해 보세요: " + r.sentence_en; speak(r.sentence_en); startMic(); };
    out.appendChild(use);
    if (r.added) out.appendChild(el("div", "saved", "📌 복습에 담았어요"));
  } catch (e) { out.innerHTML = ""; out.appendChild(el("p", "muted", "⚠️ " + e.message)); }
}

// ---------- 음성 인식 (Chrome / Edge)
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false, baseText = "";
function startMic() {
  if (!SR) { $("micNotice").hidden = false; return; }
  speechSynthesis.cancel();
  rec = new SR();
  rec.lang = "en-US"; rec.interimResults = true; rec.continuous = true;
  baseText = input.value ? input.value.trim() + " " : "";
  rec.onresult = (ev) => {
    let finalT = "", interim = "";
    for (let i = 0; i < ev.results.length; i++) {
      const t = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) finalT += t; else interim += t;
    }
    input.value = (baseText + finalT + interim).trim();
  };
  rec.onerror = (ev) => {
    if (ev.error === "not-allowed") addError("마이크 권한이 막혀 있어요. 주소창 왼쪽 자물쇠 아이콘에서 마이크를 '허용'으로 바꿔 주세요.");
    else if (ev.error !== "no-speech" && ev.error !== "aborted") addError("음성 인식 오류: " + ev.error);
  };
  rec.onend = () => { listening = false; $("micBtn").classList.remove("on"); };
  rec.start();
  listening = true;
  $("micBtn").classList.add("on");
}
function stopMic() { if (rec && listening) rec.stop(); }

// ---------- 이벤트
$("startBtn").onclick = start;
$("sendBtn").onclick = send;
$("helpBtn").onclick = help;
$("helpText").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) help(); });
$("micBtn").onclick = () => (listening ? stopMic() : startMic());
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
});
if (!SR) $("micNotice").hidden = false;

// ---------- GPT 키 설정 (이 브라우저에만 저장)
function refreshKey() {
  const has = GPT.hasKey();
  $("keyNotice").hidden = has;
  $("keyState").textContent = has ? "✅ 키가 저장돼 있어요" : "키가 없어요";
}
$("keySave").onclick = () => { GPT.setKey($("keyInput").value); $("keyInput").value = ""; refreshKey(); $("keyBox").open = false; };
$("keyDel").onclick = () => { GPT.setKey(""); refreshKey(); };
refreshKey();
if (!GPT.hasKey()) $("keyBox").open = true;
