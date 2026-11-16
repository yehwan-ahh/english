// GPT(OpenAI) 직접 호출 — 서버 없이 브라우저에서 바로 OpenAI로 보내요.
// 키는 이 브라우저(localStorage)에만 저장되고, api.openai.com 으로만 전송돼요.
(function () {
  const lsGet = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
  const lsSet = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} };

  const MODES = {
    interview: "You are a friendly interviewer at an international company, interviewing the learner for an office job. Ask typical interview questions one at a time (self-introduction, strengths, past experience, why this company, teamwork, etc.).",
    work: "You are a friendly coworker at an international company. Have everyday work conversations: small talk, meetings, schedules, asking for help, reporting progress, emails.",
    free: "You are a friendly conversation partner. Talk about the learner's day, hobbies and plans, sometimes steering gently toward work topics.",
  };

  const SYSTEM = `You help a Korean adult beginner practise spoken business English.
They know some words but struggle to turn them into sentences, and they quit when it feels like heavy correction.
What keeps them going: being understood, and building sentences from words they already know.

Role for this session: {role}

Rules for every reply:
- understood_ko: one warm Korean sentence. FIRST affirm what got across (e.g. "좋아요! 지난 회사에서 영업을 했다는 말이 잘 전달됐어요."). If the meaning was unclear, say kindly what you understood. Never list errors. Empty on the opening turn.
- natural_en: ONE more natural way to say the learner's last sentence, kept simple (A2-B1 words, close to their own words). Empty string if theirs was already fine or on the opening turn.
- natural_note_ko: one short, encouraging Korean note on the key difference (e.g. "'I am work' 대신 'I work'라고 하면 더 자연스러워요"). Empty if natural_en is empty.
- reply_en: your next line in role. 1-2 short sentences, simple everyday words, end with ONE easy question.
- reply_ko: natural Korean translation of reply_en.
- hint_en: a short sentence frame the learner could use to answer your question, with a blank, e.g. "I worked at ___ for ___ years."
- phrases: 1-3 useful chunks from this exchange worth reviewing later (prefer the natural_en version and reusable work phrases), each with a Korean meaning.
The learner's text comes from speech recognition, so ignore small transcription glitches and missing punctuation.`;

  const HELP_SYSTEM = `A Korean beginner wants to say something in English during a business conversation but is stuck.
They write what they want to say in Korean (maybe mixed with some English words).
Give ONE simple, natural spoken English sentence (A2-B1 level), then break it into 2-5 building blocks
(chunks of words) with Korean meanings, so they can see how the sentence is assembled.
Add one short encouraging Korean tip.`;

  const pair = { type: "object", properties: { en: { type: "string" }, ko: { type: "string" } }, required: ["en", "ko"], additionalProperties: false };
  const CHAT_SCHEMA = {
    type: "object",
    properties: {
      understood_ko: { type: "string" }, natural_en: { type: "string" }, natural_note_ko: { type: "string" },
      reply_en: { type: "string" }, reply_ko: { type: "string" }, hint_en: { type: "string" },
      phrases: { type: "array", items: pair },
    },
    required: ["understood_ko", "natural_en", "natural_note_ko", "reply_en", "reply_ko", "hint_en", "phrases"],
    additionalProperties: false,
  };
  const HELP_SCHEMA = {
    type: "object",
    properties: { sentence_en: { type: "string" }, blocks: { type: "array", items: pair }, tip_ko: { type: "string" } },
    required: ["sentence_en", "blocks", "tip_ko"],
    additionalProperties: false,
  };

  async function ask(system, messages, schema) {
    const key = lsGet("openai_key");
    if (!key) throw new Error("GPT 키가 아직 없어요. 위의 '🔑 GPT 키 설정'에서 키를 넣어 주세요.");
    let r;
    try {
      r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        body: JSON.stringify({
          model: lsGet("openai_model") || "gpt-5.4-mini",
          messages: [{ role: "system", content: system }, ...messages],
          response_format: { type: "json_schema", json_schema: { name: "reply", schema, strict: true } },
          reasoning_effort: "low",
          max_completion_tokens: 4000,
        }),
      });
    } catch { throw new Error("인터넷 연결을 확인해 주세요."); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const m = ((data.error && (data.error.code || data.error.message)) || "").toLowerCase();
      if (r.status === 401) throw new Error("GPT 키가 올바르지 않거나 만료됐어요. 키를 다시 확인해 주세요. (문장 조립 연습과 복습은 계속 무료로 돼요.)");
      if (m.includes("quota") || m.includes("billing")) throw new Error("GPT 사용 가능 금액/기간이 끝났어요. 문장 조립 연습과 복습은 계속 무료로 돼요.");
      if (r.status === 429) throw new Error("요청이 너무 많아요. 잠시 후 다시 시도해 주세요.");
      throw new Error(`AI 서버 오류가 났어요. (${r.status})`);
    }
    const msg = data.choices && data.choices[0] && data.choices[0].message;
    if (!msg || msg.refusal || !msg.content) throw new Error("AI가 이 요청에 답하지 않았어요. 다른 문장으로 다시 시도해 주세요.");
    return JSON.parse(msg.content);
  }

  window.GPT = {
    hasKey: () => !!lsGet("openai_key"),
    setKey: (k) => lsSet("openai_key", (k || "").trim()),
    async chat(mode, history) {
      const msgs = history.slice(-20).map((t) => ({ role: t.role === "ai" ? "assistant" : "user", content: t.text }));
      if (!msgs.length || msgs[0].role !== "user") msgs.unshift({ role: "user", content: "(Start the conversation. This is the opening turn.)" });
      const res = await ask(SYSTEM.replace("{role}", MODES[mode] || MODES.interview), msgs, CHAT_SCHEMA);
      res.added = Store.add(res.phrases || []);
      return res;
    },
    async help(korean) {
      const res = await ask(HELP_SYSTEM, [{ role: "user", content: korean }], HELP_SCHEMA);
      res.added = Store.add([{ en: res.sentence_en, ko: korean }]);
      return res;
    },
  };
})();
