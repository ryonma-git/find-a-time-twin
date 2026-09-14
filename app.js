import {
  elapsedText,
  findDataset,
  inputHint,
  isAsciiDigits,
  resolveStudentSelection,
  studentsInSet
} from "./core.js";

const app = document.querySelector("#app");
const state = {
  datasets: [],
  phase: "loading",
  code: "",
  studentText: "",
  selection: null,
  startedAt: null,
  foundAt: null,
  timesHidden: false,
  activeSpeechID: null,
  exitDialogOpen: false
};
let timerID = null;

const teacherDigest = "8c1f1046219ddd216a023f792356ddf127fce372a72ec9b4cdac989ee5b0b455";
const preferredEnglishVoices = [
  "Samantha", "Ava", "Siri", "Google US English", "Microsoft Aria", "Alex"
];
const noveltyVoiceNames = [
  "Albert", "Bad News", "Bahh", "Bells", "Boing", "Bubbles", "Cellos",
  "Deranged", "Good News", "Hysterical", "Pipe Organ", "Trinoids",
  "Whisper", "Wobble", "Zarvox"
];

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

function stopSpeech() {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  state.activeSpeechID = null;
  document.querySelectorAll("[data-speak]").forEach((button) => {
    button.classList.remove("speaking");
    button.textContent = "🔊";
  });
}

function selectNaturalEnglishVoice() {
  const voices = speechSynthesis.getVoices();
  const englishVoices = voices.filter((voice) => /^en[-_]/i.test(voice.lang));
  const safeVoices = englishVoices.filter((voice) =>
    !noveltyVoiceNames.some((name) => voice.name.toLowerCase().includes(name.toLowerCase()))
  );
  for (const preferred of preferredEnglishVoices) {
    const match = safeVoices.find((voice) => voice.name.toLowerCase().includes(preferred.toLowerCase()));
    if (match) return match;
  }
  return safeVoices.find((voice) => /^en[-_]US$/i.test(voice.lang)) ?? safeVoices[0] ?? null;
}

function speakActivity(activity) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    window.alert("このブラウザでは音声を再生できません。別のブラウザでお試しください。");
    return;
  }
  const id = activity.id;
  if (state.activeSpeechID === id) {
    stopSpeech();
    return;
  }
  stopSpeech();
  const utterance = new SpeechSynthesisUtterance(activity.timeLabel);
  utterance.lang = "en-US";
  const voice = selectNaturalEnglishVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = 0.95;
  utterance.pitch = 1.05;
  utterance.volume = 1;
  state.activeSpeechID = id;
  const button = document.querySelector(`[data-speak="${CSS.escape(id)}"]`);
  if (button) {
    button.classList.add("speaking");
    button.textContent = "■";
  }
  const finish = () => {
    if (state.activeSpeechID === id) stopSpeech();
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  speechSynthesis.speak(utterance);
}

function setupTemplate() {
  const hint = inputHint(state.datasets, state.code, state.studentText);
  const validStudent = resolveStudentSelection(state.datasets, state.code, state.studentText);
  return `
    <section class="setup-screen screen">
      <div class="setup-title">
        <div class="clock-icon" aria-hidden="true">◷</div>
        <h1>Find a Time Twin!</h1>
        <p>3つの時間が同じ友だちをさがそう。</p>
      </div>
      <form id="setup-form" class="setup-form" novalidate>
        <label>ゲームのコード
          <input id="game-code" inputmode="numeric" autocomplete="off" maxlength="4" placeholder="4けた" value="${escapeHTML(state.code)}">
        </label>
        <label>出席番号
          <input id="student-number" inputmode="numeric" autocomplete="off" maxlength="2" value="${escapeHTML(state.studentText)}">
        </label>
        <p id="input-hint" class="input-hint">${escapeHTML(hint)}</p>
        <button id="start-button" class="primary" type="submit" ${validStudent ? "" : "disabled"}>START</button>
      </form>
    </section>`;
}

function gameTemplate() {
  const { dataset, studentNumber, timeSet } = state.selection;
  const cards = dataset.activities.map((activity, index) => {
    const time = timeSet.times[index];
    return `
      <article class="activity-card">
        <img src="assets/${escapeHTML(activity.imageName)}.png" alt="" draggable="false">
        <div class="activity-label">
          <h2>${escapeHTML(activity.timeLabel)}</h2>
          <button class="speak-button" data-speak="${escapeHTML(activity.id)}" type="button" aria-label="${escapeHTML(activity.timeLabel)}を英語で聞く">🔊</button>
        </div>
        ${state.timesHidden
          ? `<p class="time hidden-time" aria-label="時刻はかくしています">••:••</p>`
          : `<p class="time" aria-label="${escapeHTML(time.displayText)}"><strong>${escapeHTML(time.clockText)}</strong><span>${escapeHTML(time.period)}</span></p>`}
      </article>`;
  }).join("");
  return `
    <section class="game-screen screen">
      <header class="game-header">
        <button id="exit-button" class="link-button" type="button">‹ 入力にもどる</button>
        <div class="game-status">
          <span>Code ${escapeHTML(dataset.code)} ・ No. ${studentNumber}</span>
          <strong id="elapsed-time" aria-label="経過時間">${elapsedText(state.startedAt, state.foundAt)}</strong>
        </div>
      </header>
      <div class="cards">${cards}</div>
      <div class="game-actions">
        <button id="toggle-times" class="primary" type="button">${state.timesHidden ? "ひょうじ" : "かくす"}</button>
        <button id="found-button" class="primary green" type="button">FOUND!</button>
      </div>
    </section>
    ${state.exitDialogOpen ? exitDialogTemplate() : ""}`;
}

function exitDialogTemplate() {
  return `
    <div class="dialog-backdrop" role="presentation">
      <section class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-message">
        <h2 id="dialog-title">入力画面にもどりますか？</h2>
        <p id="dialog-message">今のゲームとタイマーが終了します。</p>
        <div class="dialog-actions">
          <button id="continue-game" class="secondary" type="button">つづける</button>
          <button id="confirm-exit" class="danger" type="button">ゲームを終了してもどる</button>
        </div>
      </section>
    </div>`;
}

function foundTemplate() {
  return `
    <section class="found-screen screen">
      <div class="found-icon" aria-hidden="true">✓</div>
      <h1>Twin found!</h1>
      <p>同じ時間の友だちが見つかったね！</p>
      <strong class="found-time">${elapsedText(state.startedAt, state.foundAt)}</strong>
      <div class="found-actions">
        <button id="undo-found" class="secondary" type="button">Oops, go back</button>
        <button id="next-game" class="plain-action" type="button">次のゲーム</button>
      </div>
    </section>`;
}

function debugTemplate() {
  const dataset = state.selection.dataset;
  const groups = dataset.timeSets.map((set) => `
    <div class="group-row"><strong>Set ${set.id}</strong><span>${studentsInSet(dataset, set.id).join(", ")}</span></div>`).join("");
  const rows = dataset.assignments.map((setID, index) => {
    const set = dataset.timeSets.find((item) => item.id === setID);
    return `<tr id="student-${index + 1}"><th>${index + 1}</th><td>${setID}</td>${set.times.map((time) => `<td>${escapeHTML(time.displayText)}</td>`).join("")}</tr>`;
  }).join("");
  return `
    <section class="debug-screen screen">
      <header class="debug-header">
        <div><h1>Teacher Debug</h1><p>Game Code ${escapeHTML(dataset.code)}</p></div>
        <button id="debug-exit" class="secondary compact" type="button">入力にもどる</button>
      </header>
      <p class="debug-note">実際に参加している番号どうしで確認してください。欠席・欠番は一覧にも表示されます。</p>
      <div class="debug-tools"><span>出席番号 1〜40</span><div><button id="to-top" type="button">先頭へ</button><button id="to-last" type="button">40番へ</button></div></div>
      <div id="debug-top" class="groups">${groups}</div>
      <div class="table-wrap">
        <table><thead><tr><th>No.</th><th>Set</th>${dataset.activities.map((activity) => `<th>${escapeHTML(activity.displayName)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
      </div>
    </section>`;
}

function render() {
  stopTimer();
  stopSpeech();
  if (state.phase === "loading") app.innerHTML = `<p class="loading">読み込み中…</p>`;
  if (state.phase === "setup") app.innerHTML = setupTemplate();
  if (state.phase === "playing") app.innerHTML = gameTemplate();
  if (state.phase === "found") app.innerHTML = foundTemplate();
  if (state.phase === "debug") app.innerHTML = debugTemplate();
  bindEvents();
  if (state.phase === "playing") startTimer();
}

function stopTimer() {
  if (timerID != null) window.clearInterval(timerID);
  timerID = null;
}

function startTimer() {
  timerID = window.setInterval(() => {
    const output = document.querySelector("#elapsed-time");
    if (output) output.textContent = elapsedText(state.startedAt, state.foundAt);
  }, 250);
}

function resetSession({ keepStudent = true, keepCode = false } = {}) {
  stopTimer();
  stopSpeech();
  state.phase = "setup";
  if (!keepCode) state.code = "";
  if (!keepStudent) state.studentText = "";
  state.selection = null;
  state.startedAt = null;
  state.foundAt = null;
  state.timesHidden = false;
  state.exitDialogOpen = false;
  render();
}

function bindEvents() {
  if (state.phase === "setup") {
    const codeInput = document.querySelector("#game-code");
    const studentInput = document.querySelector("#student-number");
    const refreshSetup = async () => {
      state.code = codeInput.value;
      state.studentText = studentInput.value;
      const hint = inputHint(state.datasets, state.code, state.studentText);
      document.querySelector("#input-hint").textContent = hint;
      const validStudent = resolveStudentSelection(state.datasets, state.code, state.studentText);
      const startButton = document.querySelector("#start-button");
      startButton.disabled = !validStudent;
      if (!validStudent && findDataset(state.datasets, state.code) && state.studentText.length === 2 && isAsciiDigits(state.studentText)) {
        const candidate = state.studentText;
        const digest = await sha256(candidate);
        if (candidate === state.studentText && digest === teacherDigest) {
          startButton.disabled = false;
          document.querySelector("#input-hint").textContent = "ゲームのコードと、自分の出席番号を入れよう。";
        }
      }
    };
    codeInput.addEventListener("input", refreshSetup);
    studentInput.addEventListener("input", refreshSetup);
    document.querySelector("#setup-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      state.code = codeInput.value;
      state.studentText = studentInput.value;
      const studentSelection = resolveStudentSelection(state.datasets, state.code, state.studentText);
      if (studentSelection) {
        state.selection = studentSelection;
        state.startedAt = Date.now();
        state.phase = "playing";
        render();
        return;
      }
      if (findDataset(state.datasets, state.code) && await sha256(state.studentText) === teacherDigest) {
        state.selection = { dataset: findDataset(state.datasets, state.code), studentNumber: null, timeSet: null };
        state.phase = "debug";
        render();
      }
    });
  }
  if (state.phase === "playing") {
    document.querySelectorAll("[data-speak]").forEach((button) => button.addEventListener("click", () => {
      const activity = state.selection.dataset.activities.find((item) => item.id === button.dataset.speak);
      if (activity) speakActivity(activity);
    }));
    document.querySelector("#toggle-times").addEventListener("click", () => {
      stopSpeech();
      state.timesHidden = !state.timesHidden;
      render();
    });
    document.querySelector("#found-button").addEventListener("click", () => {
      state.foundAt = Date.now();
      state.phase = "found";
      render();
    });
    document.querySelector("#exit-button").addEventListener("click", () => {
      state.exitDialogOpen = true;
      render();
    });
    document.querySelector("#continue-game")?.addEventListener("click", () => {
      state.exitDialogOpen = false;
      render();
    });
    document.querySelector("#confirm-exit")?.addEventListener("click", () => resetSession({ keepCode: true }));
  }
  if (state.phase === "found") {
    document.querySelector("#undo-found").addEventListener("click", () => {
      state.foundAt = null;
      state.phase = "playing";
      render();
    });
    document.querySelector("#next-game").addEventListener("click", () => resetSession());
  }
  if (state.phase === "debug") {
    document.querySelector("#debug-exit").addEventListener("click", () => resetSession({ keepStudent: false, keepCode: true }));
    document.querySelector("#to-top").addEventListener("click", () => document.querySelector("#debug-top").scrollIntoView({ behavior: "smooth" }));
    document.querySelector("#to-last").addEventListener("click", () => document.querySelector("#student-40").scrollIntoView({ behavior: "smooth", block: "end" }));
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopSpeech();
});
window.addEventListener("beforeunload", stopSpeech);

async function boot() {
  try {
    const response = await fetch("data.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.datasets = await response.json();
    state.phase = "setup";
    render();
  } catch (error) {
    console.error(error);
    app.innerHTML = `<section class="load-error"><h1>読み込めませんでした</h1><p>ページをもう一度読み込んでください。</p></section>`;
  }
}

boot();
