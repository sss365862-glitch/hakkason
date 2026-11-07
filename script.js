// ============================================================
// 動きと演出、Geminiへの問い合わせ
// 文章・名前・色・画像は config.js、見た目は style.css を直す
// ============================================================

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const stage = $("stage");
const box = $("monsterBox");
const monster = $("monster");
const fx = $("fx");
const input = $("thoughtInput");

let runId = 0;        // やり直しで古い演出・遅れた応答を捨てるための番号
let busy = false;     // 演出中は操作を受け付けない
let phase = "idle";   // idle（卵）→ observing（観測中）→ end（消失後）
let form = 0;         // 0 = 卵、1〜MAX_FORM = 形態
let route = null;     // { first, emotion, thoughts[STEPS], source: "ai" | "sample" }

const MAX_FORM = PREFIXES.length;  // 形態の数（config.jsの接頭語の数）
const STEPS = MAX_FORM - 1;        // 進化の回数 = 必要な思考の数

// ------------------------------------------------------------
// 図形で怪物を描く（viewBox -100〜100）
// ------------------------------------------------------------
function coreShape(shape, r, color, extra = "") {
  const s = `fill="${color}" stroke="#fff" stroke-width="2" ${extra}`;
  if (shape === "triangle") return `<polygon points="0,${-r} ${r * 0.95},${r * 0.7} ${-r * 0.95},${r * 0.7}" ${s}/>`;
  if (shape === "diamond") return `<polygon points="0,${-r} ${r * 0.8},0 0,${r} ${-r * 0.8},0" ${s}/>`;
  if (shape === "square") return `<rect x="${-r * 0.8}" y="${-r * 0.8}" width="${r * 1.6}" height="${r * 1.6}" rx="6" ${s}/>`;
  if (shape === "circle") return `<circle r="${r * 0.85}" ${s}/>`;
  // star（ギザギザ）
  return `<polygon points="${zigzag(r, r * 0.72, 10)}" ${s}/>`;
}

function zigzag(outer, inner, n) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const rr = i % 2 === 0 ? outer : inner;
    pts.push(`${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`);
  }
  return pts.join(" ");
}

function eye(x, y, size, open = 1) {
  return `<ellipse cx="${x}" cy="${y}" rx="${size}" ry="${Math.max(1, size * open)}" fill="#fff"/>` +
         `<circle cx="${x}" cy="${y}" r="${size * 0.45 * Math.max(0.3, open)}" fill="#111"/>`;
}

function drawMonster(emotionName, f) {
  const e = EMOTIONS[emotionName];
  const c = e.color;
  // 進化の段階を 0〜4 の装飾レベルに直す（形態の数が変わっても最終形態は4）
  const k = MAX_FORM > 1 ? Math.round(((f - 1) * 4) / (MAX_FORM - 1)) : 4;
  const r = 46;
  let back = "";   // 体の後ろ
  let front = "";  // 体の前（目など）
  let body = coreShape(e.shape, r, c);

  // 共通：レベル2から角、レベル3から脚、最終形態で外側の輪郭
  if (k >= 2) back += `<polygon points="-30,-38 -46,-78 -14,-44" fill="${c}"/><polygon points="30,-38 46,-78 14,-44" fill="${c}"/>`;
  if (k >= 3) for (let i = -1; i <= 1; i += 2) back += `<path d="M${i * 22},40 L${i * 34},82 L${i * 44},84" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  if (k >= 4) back = `<polygon points="${zigzag(98, 80, 18)}" fill="none" stroke="${c}" stroke-width="3" opacity="0.7"/>` + back;

  if (emotionName === "焦り") {
    // 針のような角と脚が増える
    for (let i = 0; i < k * 2; i++) {
      const a = (-150 + (i * 120) / Math.max(1, k * 2 - 1)) * (Math.PI / 180);
      back += `<line x1="0" y1="-10" x2="${(Math.cos(a) * 92).toFixed(1)}" y2="${(Math.sin(a) * 92).toFixed(1)}" stroke="${c}" stroke-width="3"/>`;
    }
    for (let i = 0; i < (k + 1) * 2; i++) {
      const x = -36 + (72 * i) / Math.max(1, (k + 1) * 2 - 1);
      back += `<line x1="${x.toFixed(1)}" y1="30" x2="${(x * 1.3).toFixed(1)}" y2="${70 + k * 5}" stroke="${c}" stroke-width="3"/>`;
    }
    front += eye(-14, 10, 9) + eye(14, 10, 9);
  } else if (emotionName === "恐怖") {
    // 影が伸び、中央の目が開いていく
    back = `<ellipse cx="0" cy="${60 + k * 4}" rx="${40 + k * 14}" ry="${10 + k * 3}" fill="#000" opacity="${0.4 + k * 0.1}"/>` + back;
    for (let i = 0; i < k; i++) back += `<path d="M${-20 + i * 14},40 Q${-30 + i * 20},${80 + i * 4} ${-40 + i * 26},96" stroke="#2a0a40" stroke-width="5" fill="none"/>`;
    front += eye(0, 0, 14 + k * 2, 0.1 + k * 0.22);
  } else if (emotionName === "怒り") {
    // 輪郭が張り出し、トゲが増える
    body = `<polygon points="${zigzag(r + k * 4, r * 0.7, 10 + k * 3)}" fill="${c}" stroke="#fff" stroke-width="2"/>`;
    for (let i = 0; i < k * 4; i++) {
      const a = (Math.PI * 2 * i) / (k * 4);
      const x1 = Math.cos(a) * 52, y1 = Math.sin(a) * 52, x2 = Math.cos(a) * (70 + k * 5), y2 = Math.sin(a) * (70 + k * 5);
      back += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}" stroke-width="4"/>`;
    }
    front += `<path d="M-24,-6 L-6,2" stroke="#111" stroke-width="4"/><path d="M24,-6 L6,2" stroke="#111" stroke-width="4"/>` + eye(-14, 10, 7) + eye(14, 10, 7);
  } else if (emotionName === "恥ずかしさ") {
    // 最初は小さく縮まり、進化で目があちこちに開く
    if (k === 0) body = coreShape("circle", r * 0.7, c);
    const spots = [[-14, 4], [14, 4], [-26, -20], [24, -24], [0, -32], [-30, 18], [30, 20], [-8, 28], [12, 30], [0, 12]];
    const n = Math.min(spots.length, 2 + k * 2);
    for (let i = 0; i < n; i++) front += eye(spots[i][0], spots[i][1], i < 2 ? 7 : 5);
    front += `<ellipse cx="-22" cy="18" rx="8" ry="4" fill="#ff2e63" opacity="0.6"/><ellipse cx="22" cy="18" rx="8" ry="4" fill="#ff2e63" opacity="0.6"/>`;
  } else if (emotionName === "後悔") {
    // 過去の姿が残像のように重なり、影を引きずる
    for (let i = k; i >= 1; i--) back += `<g transform="translate(${-14 * i},${6 * i})" opacity="${(0.5 / i).toFixed(2)}">${coreShape("square", r, c)}</g>`;
    back = `<path d="M-40,48 Q-90,60 ${-100 - k * 20},${70 + k * 4}" stroke="#000" stroke-width="${8 + k * 3}" opacity="0.5" fill="none"/>` + back;
    front += eye(-14, 6, 8, 0.5) + eye(14, 6, 8, 0.5);
  }

  return `<svg viewBox="-100 -100 200 200" xmlns="http://www.w3.org/2000/svg">${back}${body}${front}</svg>`;
}

function drawEgg() {
  return `<svg viewBox="-100 -100 200 200" xmlns="http://www.w3.org/2000/svg">
    <g class="egg-shell">
      <ellipse cx="0" cy="8" rx="56" ry="72" fill="#f4f1e8" stroke="#fff" stroke-width="2"/>
      <ellipse cx="-18" cy="-22" rx="12" ry="20" fill="#fff" opacity="0.6"/>
      <path class="egg-crack" d="M-52,0 L-30,-12 L-14,6 L4,-14 L20,4 L36,-10 L54,2"/>
    </g>
  </svg>`;
}

// 画像が設定されていれば画像、なければ図形
function showMonster(emotionName, f) {
  const src = EMOTIONS[emotionName].images[f - 1];
  monster.className = "monster anim-" + EMOTIONS[emotionName].shape;
  if (src) {
    const img = new Image();
    img.alt = "";
    img.onerror = () => { monster.innerHTML = drawMonster(emotionName, f); };
    img.src = src;
    monster.innerHTML = "";
    monster.appendChild(img);
  } else {
    monster.innerHTML = drawMonster(emotionName, f);
  }
}

// 形態ごとの大きさ（舞台の高さに対する割合）。最終形態は舞台からはみ出す
function setSize(f) {
  const h = stage.clientHeight, w = stage.clientWidth;
  let px;
  if (f === 0) px = h * 0.42;
  else if (f === MAX_FORM) px = Math.max(w, h) * 1.15;
  else px = h * (0.36 + (0.38 * (f - 1)) / Math.max(1, MAX_FORM - 2));
  box.style.width = px + "px";
  box.style.height = px + "px";
}

// ------------------------------------------------------------
// 文字 → 光の塊 → 体に染み込む
// ------------------------------------------------------------
function spawnWord(text, xRatio, yRatio) {
  const el = document.createElement("div");
  el.className = "word show";
  el.textContent = text;
  el.style.left = stage.clientWidth * xRatio + "px";
  el.style.top = stage.clientHeight * yRatio + "px";
  fx.appendChild(el);
  return el;
}

async function absorbInto(el, my) {
  el.classList.add("blob");
  await wait(450);
  if (my !== runId) return;
  const s = stage.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  el.classList.add("move");
  el.style.left = b.left - s.left + b.width / 2 + "px";
  el.style.top = b.top - s.top + b.height * 0.35 + "px";
  await wait(600);
  el.remove();
  if (my !== runId) return;
  box.classList.remove("absorb");
  void box.offsetWidth;
  box.classList.add("absorb");
  await wait(600);
}

// ------------------------------------------------------------
// Gemini（サーバー側）への問い合わせ。4秒で打ち切り
// ------------------------------------------------------------
async function askAI(text) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SETTINGS.apiTimeoutMs);
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, count: STEPS }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const d = await res.json();
    return isValid(d) ? { emotion: d.emotion, thoughts: d.thoughts.slice(0, STEPS).map((t) => t.trim()) } : null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function isValid(d) {
  if (!d || !EMOTIONS[d.emotion] || !Array.isArray(d.thoughts) || d.thoughts.length < STEPS) return false;
  const list = d.thoughts.slice(0, STEPS);
  if (!list.every((t) => typeof t === "string" && t.trim().length > 0 && t.length <= 30)) return false;
  const all = list.join(" ");
  return !NG_WORDS.some((w) => all.includes(w));
}

// ------------------------------------------------------------
// 画面の切り替え
// ------------------------------------------------------------
function setAccent(emotionName) {
  document.documentElement.style.setProperty("--accent", emotionName ? EMOTIONS[emotionName].color : "#f5c518");
}

function nameOf(f) {
  return PREFIXES[f - 1] + EMOTIONS[route.emotion].base;
}

function updateLabels() {
  $("formLabel").textContent = `形態 ${form} / ${MAX_FORM}`;
  $("aiLabel").textContent = route.source === "ai" ? `AIの解釈：${route.emotion}` : `サンプルルート：${route.emotion}`;
  $("monsterName").textContent = nameOf(form);
}

function showPanel(name) {
  ["startPanel", "nextPanel", "throwPanel", "againPanel"].forEach((p) => $(p).classList.toggle("hidden", p !== name));
}

function setStartEnabled(on) {
  document.querySelectorAll("#startPanel button, #startPanel input").forEach((el) => (el.disabled = !on));
}

function reset() {
  runId++;
  busy = false;
  phase = "idle";
  form = 0;
  route = null;
  fx.innerHTML = "";
  $("cracks").innerHTML = "";
  stage.className = "stage";
  $("whiteout").classList.remove("on");
  $("endText").classList.remove("on");
  $("monsterName").textContent = "";
  $("monsterName").classList.remove("big");
  $("formLabel").textContent = "";
  $("aiLabel").textContent = "";
  $("toast").textContent = "";
  $("message").textContent = "";
  document.querySelectorAll(".shard, .piece, .burst").forEach((s) => s.remove());
  $("orb").className = "orb hidden";
  setAccent(null);
  box.style.opacity = "1";
  box.className = "monster-box";
  monster.className = "monster";
  monster.innerHTML = drawEgg();
  setSize(0);
  input.value = SAMPLE_ROUTE.first;
  setStartEnabled(true);
  showPanel("startPanel");
}

// ------------------------------------------------------------
// 開始と孵化（形態1）
// ------------------------------------------------------------
async function start(raw) {
  if (busy || phase !== "idle") return;
  const text = (raw || "").trim();
  if (!text) {
    $("message").textContent = "小さな不安を一言入力してください";
    input.focus();
    return;
  }
  busy = true;
  const my = ++runId;
  $("message").textContent = "";
  setStartEnabled(false);

  const aiPromise = askAI(text); // 開始と同時に問い合わせ

  const w = spawnWord(text, 0.5, 0.18);
  await wait(800);
  if (my !== runId) return;
  await absorbInto(w, my);
  if (my !== runId) return;
  box.classList.add("cracking");

  const ai = await aiPromise;
  if (my !== runId) return; // やり直し後に来た応答は捨てる
  await wait(500);
  if (my !== runId) return;

  if (ai) {
    route = { first: text, emotion: ai.emotion, thoughts: ai.thoughts, source: "ai" };
  } else {
    if (text !== SAMPLE_ROUTE.first) {
      $("toast").textContent = `AIが応答しなかったため、例文『${SAMPLE_ROUTE.first}』で続けます`;
      input.value = SAMPLE_ROUTE.first;
      await wait(1200);
      if (my !== runId) return;
    }
    route = { first: SAMPLE_ROUTE.first, emotion: SAMPLE_ROUTE.emotion, thoughts: SAMPLE_ROUTE.thoughts.slice(), source: "sample" };
  }

  // 殻が割れて小さな怪物が出る
  form = 1;
  phase = "observing";
  setAccent(route.emotion);
  box.classList.remove("cracking");
  showMonster(route.emotion, 1);
  setSize(1);
  box.classList.remove("pop");
  void box.offsetWidth;
  box.classList.add("pop");
  updateLabels();
  showPanel("nextPanel");
  $("nextBtn").disabled = false;
  $("nextBtn").focus();
  busy = false;
}

// ------------------------------------------------------------
// 次の思考（形態2〜5）
// ------------------------------------------------------------
async function next() {
  if (busy || phase !== "observing" || form >= MAX_FORM) return;
  busy = true;
  $("nextBtn").disabled = true;
  const my = runId;
  const target = form + 1;
  const thought = route.thoughts[target - 2];

  // 文字を先に読ませる
  const w = spawnWord(thought, 0.5, 0.12);
  await wait(SETTINGS.thoughtReadMs);
  if (my !== runId) return;
  await absorbInto(w, my);
  if (my !== runId) return;

  // 白い光の膜で隠して、次の形態へ
  $("whiteout").classList.add("on");
  await wait(380);
  if (my !== runId) return;
  form = target;
  if (form === MAX_FORM) stage.classList.add("final");
  showMonster(route.emotion, form);
  setSize(form);
  updateLabels();
  $("whiteout").classList.remove("on");
  box.classList.remove("pop");
  void box.offsetWidth;
  box.classList.add("pop");
  await wait(500);
  if (my !== runId) return;

  if (form === MAX_FORM) {
    await readyToThrow(my);
    return;
  }
  $("nextBtn").disabled = false;
  $("nextBtn").focus();
  busy = false;
}

// ------------------------------------------------------------
// 最終形態：不安の塊を投げると爆発する
// ------------------------------------------------------------
async function readyToThrow(my) {
  showPanel(null);
  $("monsterName").classList.add("big");
  await wait(900);
  if (my !== runId) return;
  const orb = $("orb");
  orb.style.left = "";
  orb.style.top = "";
  orb.className = "orb";
  showPanel("throwPanel");
  phase = "throw";
  orb.focus();
  busy = false;
}

async function throwOrb() {
  if (busy || phase !== "throw") return;
  busy = true;
  const my = runId;
  const orb = $("orb");
  // 塊が怪物の中心へ飛んでいく
  const s = stage.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  orb.classList.add("thrown");
  orb.style.left = b.left - s.left + b.width / 2 + "px";
  orb.style.top = b.top - s.top + b.height / 2 + "px";
  showPanel(null);
  await wait(550);
  if (my !== runId) return;
  orb.className = "orb hidden";
  box.classList.remove("absorb");
  void box.offsetWidth;
  box.classList.add("absorb");
  await finale(my);
}

// ------------------------------------------------------------
// 爆発
// ------------------------------------------------------------
async function finale(my) {
  phase = "exploding";
  // 怪物と背景にひびが走る
  const W = stage.clientWidth, H = stage.clientHeight;
  let paths = "";
  for (let i = 0; i < 9; i++) {
    let x = W / 2, y = H / 2, d = `M${x},${y}`;
    const a = (Math.PI * 2 * i) / 9 + Math.random() * 0.4;
    for (let j = 0; j < 7; j++) {
      x += Math.cos(a) * (W / 12) + (Math.random() - 0.5) * 40;
      y += Math.sin(a) * (H / 12) + (Math.random() - 0.5) * 40;
      d += ` L${x.toFixed(0)},${y.toFixed(0)}`;
    }
    paths += `<path d="${d}"/>`;
  }
  $("cracks").innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${paths}</svg>`;
  await wait(900);
  if (my !== runId) return;

  // 破片が外へ飛び、舞台が暗転
  const img = monster.querySelector("img");
  if (img && img.complete && img.naturalWidth) {
    shatterImage(img.src, W, H);
  } else {
    shatterShapes(W, H);
  }
  const ring = document.createElement("div");
  ring.className = "burst";
  ring.style.left = W / 2 + "px";
  ring.style.top = H / 2 + "px";
  ring.style.width = ring.style.height = Math.max(W, H) * 1.4 + "px";
  stage.appendChild(ring);
  box.style.opacity = "0";
  $("monsterName").textContent = "";
  $("cracks").innerHTML = "";
  stage.classList.remove("final");
  stage.classList.add("dark");
  await wait(1300);
  if (my !== runId) return;
  document.querySelectorAll(".shard, .piece, .burst").forEach((s) => s.remove());
  $("endText").classList.add("on");
  $("formLabel").textContent = "観測対象、消失";
  $("aiLabel").textContent = "";
  phase = "end";
  showPanel("againPanel");
  $("againBtn").focus();
  busy = false;
}


// 図形の怪物：三角の破片が飛ぶ
function shatterShapes(W, H) {
  for (let i = 0; i < 28; i++) {
    const s = document.createElement("div");
    s.className = "shard";
    s.style.left = W / 2 - 30 + (Math.random() - 0.5) * 200 + "px";
    s.style.top = H / 2 - 30 + (Math.random() - 0.5) * 200 + "px";
    const a = Math.random() * Math.PI * 2, dist = 400 + Math.random() * 500;
    s.style.setProperty("--dx", Math.cos(a) * dist + "px");
    s.style.setProperty("--dy", Math.sin(a) * dist + "px");
    s.style.setProperty("--rot", (Math.random() - 0.5) * 900 + "deg");
    stage.appendChild(s);
  }
}

// 画像の怪物：画像そのものが割れて、かけらが飛び散る
function shatterImage(src, W, H) {
  const s = stage.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  const left = b.left - s.left, top = b.top - s.top, size = b.width;
  const n = 7; // 7×7 に割る
  const cell = size / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const p = document.createElement("div");
      p.className = "piece";
      p.style.left = left + c * cell + "px";
      p.style.top = top + r * cell + "px";
      p.style.width = p.style.height = cell + "px";
      p.style.backgroundImage = `url("${src}")`;
      p.style.backgroundSize = `${size}px ${size}px`;
      p.style.backgroundPosition = `${-c * cell}px ${-r * cell}px`;
      // 中心から外へ向かって飛ぶ
      const cx = c - (n - 1) / 2, cy = r - (n - 1) / 2;
      const a = Math.atan2(cy, cx) + (Math.random() - 0.5) * 0.6;
      const dist = 300 + Math.random() * 600;
      p.style.setProperty("--dx", Math.cos(a) * dist + "px");
      p.style.setProperty("--dy", Math.sin(a) * dist + "px");
      p.style.setProperty("--rot", (Math.random() - 0.5) * 720 + "deg");
      p.style.clipPath = ["polygon(0 0,100% 0,100% 100%)", "polygon(0 0,100% 100%,0 100%)", "polygon(10% 0,100% 20%,80% 100%,0 70%)"][(r + c) % 3];
      stage.appendChild(p);
    }
  }
}

// ------------------------------------------------------------
// 操作をつなぐ
// ------------------------------------------------------------
$("observeBtn").addEventListener("click", () => start(input.value));
document.querySelectorAll(".example").forEach((b) =>
  b.addEventListener("click", () => {
    input.value = b.dataset.text;
    start(b.dataset.text);
  })
);
$("nextBtn").addEventListener("click", next);
$("orb").addEventListener("click", throwOrb);
$("againBtn").addEventListener("click", reset);

// 長押しEnterの連続入力は捨てる（段階飛ばし防止）
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.repeat) { e.preventDefault(); e.stopPropagation(); } }, true);

document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.repeat) return;
  if (e.isComposing || e.keyCode === 229) return;   // 日本語変換の確定は無視
  if (e.target.tagName === "BUTTON") return;        // ボタン上のEnterはクリックとして処理される
  e.preventDefault();
  if (phase === "idle") start(input.value);
  else if (phase === "observing") next();
  else if (phase === "throw") throwOrb();
});

window.addEventListener("resize", () => { if (phase !== "end") setSize(form); });

reset();
