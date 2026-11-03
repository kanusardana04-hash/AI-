/* ================= StudySphere – script.js =================
   Vanilla JavaScript only. Beginner-friendly and commented. */

// ---------- 1. CONFIGURATION (the ONLY place to set the API key) ----------
// WARNING: Anyone who opens this page can see this key. Use a restricted/test key.
const GEMINI_API_KEY = "";
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const HISTORY_KEY = "studysphere_history";

// Short helper to find an element by id
const $ = (id) => document.getElementById(id);

// ---------- 2. NAVIGATION ----------
function showPage(name) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.page === name));
  $("page-" + name).classList.add("active");
  if (name === "dashboard") renderDashboard();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- 3. GEMINI API REQUEST ----------
// Sends a prompt to Gemini and returns the response text. Throws Error on failure.
async function callGemini(prompt, wantJson = false) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_API_KEY_HERE") {
    throw new Error("API key missing. Open script.js and set GEMINI_API_KEY.");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const body = { contents: [{ parts: [{ text: prompt }] }] };
  if (wantJson) body.generationConfig = { responseMimeType: "application/json" };

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error("Network error. Check your internet connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.error && data.error.message) || "Gemini request failed (" + res.status + ").");
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("");
  if (!text) throw new Error("Gemini returned an empty response. Please try again.");
  return text;
}

// Small UI helpers for loading / error messages and disabling buttons
function setMsg(id, text, type = "") { const m = $(id); m.textContent = text; m.className = "msg " + type; }
function setBusy(btnId, busy) { $(btnId).disabled = busy; }

// ---------- 4. QUIZ GENERATION ----------
let currentQuiz = null; // { topic, questions: [{question, options, correct}] }

function randomItem(list) { return list[Math.floor(Math.random() * list.length)]; }

// Random focus angles + styles make each quiz different (uniqueness is not guaranteed)
function buildQuizPrompt(topic, count, level) {
  const angles = ["key definitions", "real-world applications", "common mistakes", "cause and effect", "history and origins", "problem solving", "comparisons between concepts", "important terminology"];
  const styles = ["conceptual", "scenario-based", "fact-recall", "application-focused"];
  return `Create ${count} multiple-choice questions about "${topic}" at ${level} difficulty.
Focus mainly on: ${randomItem(angles)} and ${randomItem(angles)}. Question style: ${randomItem(styles)}. Variation seed: ${Math.floor(Math.random() * 100000)}.
Return ONLY a JSON array. Each item must be:
{"question":"text","options":["A","B","C","D"],"answer":"the exact text of the correct option"}
Exactly 4 distinct options per question.`;
}

// Fisher–Yates shuffle (returns a new shuffled array)
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Validate Gemini's JSON and shuffle options. We store the correct ANSWER TEXT,
// so the right answer is still known after shuffling.
function validateQuestions(raw) {
  let list;
  try { list = JSON.parse(raw.replace(/```json|```/g, "").trim()); }
  catch (e) { throw new Error("Gemini sent invalid JSON. Please try again."); }
  if (!Array.isArray(list)) throw new Error("Unexpected quiz format. Please try again.");
  const valid = list.filter((q) =>
    q && typeof q.question === "string" && Array.isArray(q.options) &&
    q.options.length === 4 && new Set(q.options).size === 4 &&
    typeof q.answer === "string" && q.options.includes(q.answer));
  if (valid.length === 0) throw new Error("No valid questions were returned. Please try again.");
  return valid.map((q) => ({ question: q.question, options: shuffleArray(q.options), correct: q.answer }));
}

async function generateQuiz() {
  const topic = $("quizTopic").value.trim();
  if (!topic) return setMsg("quizMsg", "Please enter a topic first.", "error");
  const count = $("quizCount").value, level = $("quizLevel").value;
  setBusy("quizGenerate", true); $("quizArea").innerHTML = "";
  setMsg("quizMsg", "Generating your quiz…", "loading");
  try {
    const raw = await callGemini(buildQuizPrompt(topic, count, level), true);
    currentQuiz = { topic, questions: validateQuestions(raw) };
    renderQuiz();
    setMsg("quizMsg", `Quiz ready: ${currentQuiz.questions.length} questions.`);
  } catch (e) { setMsg("quizMsg", e.message, "error"); }
  setBusy("quizGenerate", false);
}

// ---------- 5. QUESTION RENDERING ----------
function renderQuiz() {
  const area = $("quizArea"); area.innerHTML = "";
  currentQuiz.questions.forEach((q, i) => {
    const card = document.createElement("div"); card.className = "card q";
    const h = document.createElement("h3"); h.textContent = `${i + 1}. ${q.question}`; card.appendChild(h);
    q.options.forEach((opt) => {
      const label = document.createElement("label"); label.className = "opt";
      const radio = document.createElement("input"); radio.type = "radio"; radio.name = "q" + i; radio.value = opt;
      const span = document.createElement("span"); span.textContent = opt;
      label.append(radio, span); card.appendChild(label);
    });
    area.appendChild(card);
  });
  const btn = document.createElement("button"); btn.className = "btn"; btn.id = "quizSubmit"; btn.textContent = "Submit quiz";
  btn.addEventListener("click", submitQuiz); area.appendChild(btn);
}

// ---------- 6. SUBMISSION, SCORE, REVIEW ----------
function calculateScore(questions, answers) {
  let score = 0;
  questions.forEach((q, i) => { if (answers[i] === q.correct) score++; });
  return score;
}

function submitQuiz() {
  const answers = currentQuiz.questions.map((q, i) => {
    const picked = document.querySelector(`input[name="q${i}"]:checked`);
    return picked ? picked.value : null;
  });
  if (answers.includes(null) && !confirm("Some questions are unanswered. Submit anyway?")) return;

  const total = currentQuiz.questions.length;
  const score = calculateScore(currentQuiz.questions, answers);
  const percent = Math.round((score / total) * 100);
  saveHistory({ topic: currentQuiz.topic, score, total, percent, date: new Date().toISOString() });

  // Review: mark correct (green) and wrong (red) options, then lock the quiz
  document.querySelectorAll("#quizArea .q").forEach((card, i) => {
    card.querySelectorAll(".opt").forEach((label) => {
      const val = label.querySelector("input").value;
      label.querySelector("input").disabled = true;
      if (val === currentQuiz.questions[i].correct) label.classList.add("correct");
      else if (val === answers[i]) label.classList.add("wrong");
    });
  });
  $("quizSubmit").remove();
  const res = document.createElement("div"); res.className = "card result";
  res.innerHTML = `<b>${score} / ${total}</b><p>${percent}% – green shows the correct answers.</p>`;
  $("quizArea").prepend(res);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- 7. QUIZ HISTORY (localStorage) ----------
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) { return []; }
}
function saveHistory(entry) {
  const list = loadHistory(); list.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 100)));
}

// ---------- 8. DASHBOARD STATISTICS ----------
function renderDashboard() {
  const h = loadHistory();
  const best = h.length ? Math.max(...h.map((x) => x.percent)) : 0;
  const avg = h.length ? Math.round(h.reduce((s, x) => s + x.percent, 0) / h.length) : 0;
  $("statTotal").textContent = h.length; $("statBest").textContent = best + "%"; $("statAvg").textContent = avg + "%";
  $("ringText").textContent = avg + "%"; $("ring").style.setProperty("--p", avg);

  const list = $("historyList"); list.innerHTML = "";
  if (!h.length) list.innerHTML = '<li class="empty">No quizzes yet. Take your first quiz to see it here.</li>';
  h.slice(0, 6).forEach((x) => {
    const li = document.createElement("li");
    const left = document.createElement("div"); const t = document.createElement("b"); t.textContent = x.topic;
    const d = document.createElement("small"); d.textContent = `${x.score}/${x.total} · ${new Date(x.date).toLocaleDateString()}`;
    left.append(t, d);
    const pill = document.createElement("span"); pill.className = "pill" + (x.percent < 50 ? " low" : ""); pill.textContent = x.percent + "%";
    li.append(left, pill); list.appendChild(li);
  });

  // Study progress: best score per topic
  const best_by = {}; h.forEach((x) => { const k = x.topic.toLowerCase(); best_by[k] = Math.max(best_by[k] || 0, x.percent); });
  const box = $("progressList"); box.innerHTML = "";
  const topics = Object.entries(best_by).slice(0, 5);
  if (!topics.length) box.innerHTML = '<p class="empty">Your topic progress will appear after a quiz.</p>';
  topics.forEach(([name, pct]) => {
    const row = document.createElement("div");
    row.innerHTML = `<small></small><div class="bar"><i style="width:${pct}%"></i></div>`;
    row.querySelector("small").textContent = `${name} – ${pct}%`; box.appendChild(row);
  });
}

// ---------- 9. TEXT RENDERING (for notes & writing) ----------
// Turns simple markdown (## heading, - bullet, paragraphs) into safe DOM elements.
function renderText(container, text) {
  container.innerHTML = ""; container.hidden = false;
  let ul = null;
  text.split("\n").forEach((line) => {
    line = line.trim().replace(/\*\*/g, "");
    if (!line) { ul = null; return; }
    if (/^#{1,4}\s/.test(line)) { ul = null; const h = document.createElement("h3"); h.textContent = line.replace(/^#+\s*/, ""); container.appendChild(h); }
    else if (/^[-*•]\s/.test(line)) {
      if (!ul) { ul = document.createElement("ul"); container.appendChild(ul); }
      const li = document.createElement("li"); li.textContent = line.replace(/^[-*•]\s*/, ""); ul.appendChild(li);
    } else { ul = null; const p = document.createElement("p"); p.textContent = line; container.appendChild(p); }
  });
}

// Study material generation
async function generateNotes() {
  const topic = $("notesTopic").value.trim();
  if (!topic) return setMsg("notesMsg", "Please enter a topic first.", "error");
  setBusy("notesGenerate", true); setMsg("notesMsg", "Writing your notes…", "loading");
  try {
    const text = await callGemini(`Write study notes on "${topic}" for a college student. Use this layout: a "## Summary" heading with 2-3 sentences, then 3-5 "## " section headings each followed by "- " bullet points. Plain text only.`);
    renderText($("notesOut"), text); setMsg("notesMsg", "");
  } catch (e) { setMsg("notesMsg", e.message, "error"); }
  setBusy("notesGenerate", false);
}

// Writing generation (essay / summary / explanation)
async function generateWriting() {
  const topic = $("writeTopic").value.trim(), type = $("writeType").value;
  if (!topic) return setMsg("writeMsg", "Please enter a topic first.", "error");
  const rules = {
    essay: "a well-structured essay (introduction, 3 body paragraphs, conclusion) of about 400 words",
    summary: "a clear summary of about 150 words",
    explanation: "a simple step-by-step explanation with examples, about 250 words",
  };
  setBusy("writeGenerate", true); setMsg("writeMsg", "Writing…", "loading");
  try {
    const text = await callGemini(`Write ${rules[type]} on "${topic}". Use "## " for any headings. Plain text only.`);
    renderText($("writeOut"), text); setMsg("writeMsg", "");
  } catch (e) { setMsg("writeMsg", e.message, "error"); }
  setBusy("writeGenerate", false);
}

// ---------- 10. EVENT WIRING ----------
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => showPage(t.dataset.page)));
document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => showPage(b.dataset.go)));
$("quizGenerate").addEventListener("click", generateQuiz);
$("notesGenerate").addEventListener("click", generateNotes);
$("writeGenerate").addEventListener("click", generateWriting);
$("clearHistory").addEventListener("click", () => { if (confirm("Delete all quiz history?")) { localStorage.removeItem(HISTORY_KEY); renderDashboard(); } });
renderDashboard();
