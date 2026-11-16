// 복습 카드 저장소 — 이 브라우저(이 기기) 안에만 저장돼요. 서버가 필요 없어요.
(function () {
  const KEY = "cards_v2";
  const INTERVALS = [0, 1, 3, 7, 14, 30]; // 상자별 다음 복습까지 날짜
  const NEW_PER_DAY = 10; // 하루에 새로 나오는 카드 수

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); const t = new Date(d); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
  const keyOf = (en) => en.toLowerCase().replace(/[.!?]+$/, "").trim();

  let mem = null; // localStorage가 막힌 경우(사생활 보호 모드 등)를 위한 임시 저장
  function read() {
    try { const v = localStorage.getItem(KEY); if (v) return JSON.parse(v); } catch {}
    return mem;
  }
  function write(db) {
    mem = db;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
  }
  function card(en, ko, isNew) {
    return { id: Math.random().toString(36).slice(2, 10), en: en.trim(), ko: ko.trim(), box: 0, due: today(), isNew: !!isNew };
  }
  function load() {
    let db = read();
    if (!db) {
      db = { cards: [], newDate: "", newCount: 0 };
      (window.SEED_CARDS || []).forEach((c) => db.cards.push(card(c.en, c.ko, false)));
      // 연습 문장도 모두 넣어 두고, 하루 몇 개씩 새로 나오게 해요 (PC 없이 폰만으로도 복습 가능)
      (window.LESSONS || []).forEach((l) => l.answers.forEach((a) => db.cards.push(card(a.blocks.join(" "), a.ko, true))));
      write(db);
    }
    return db;
  }

  window.Store = {
    all() { return load().cards; },
    due() {
      const db = load(), t = today();
      if (db.newDate !== t) { db.newDate = t; db.newCount = 0; write(db); }
      const old = db.cards.filter((c) => !c.isNew && c.due <= t);
      const fresh = db.cards.filter((c) => c.isNew).slice(0, Math.max(0, NEW_PER_DAY - db.newCount));
      return old.concat(fresh);
    },
    // grade: 0=몰랐어요, 1=헷갈려요, 2=알았어요
    review(id, grade) {
      const db = load();
      const c = db.cards.find((x) => x.id === id);
      if (!c) return;
      if (c.isNew) { c.isNew = false; if (db.newDate === today()) db.newCount++; }
      let days;
      if (grade === 0) { c.box = 0; days = 0; }
      else if (grade === 1) { days = Math.max(1, Math.floor(INTERVALS[c.box] / 2)); }
      else { c.box = Math.min(c.box + 1, INTERVALS.length - 1); days = INTERVALS[c.box]; }
      c.due = addDays(days);
      write(db);
    },
    // 새 표현 추가. 이미 있는 '새 카드'면 오늘 바로 복습에 나오게 해요. 추가/활성화된 개수 반환
    add(list) {
      const db = load();
      const known = new Map(db.cards.map((c) => [keyOf(c.en), c]));
      let n = 0;
      list.forEach(({ en, ko }) => {
        if (!en || !ko) return;
        const c = known.get(keyOf(en));
        if (!c) { const nc = card(en, ko, false); db.cards.push(nc); known.set(keyOf(en), nc); n++; }
        else if (c.isNew) { c.isNew = false; c.due = today(); n++; }
      });
      write(db);
      return n;
    },
  };
})();
