const STORAGE_KEY = "daily-checklist-v1";

function todayKey() {
  const d = new Date();
  // 로컬 날짜 기준 YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function defaultTasks() {
  return [
    { id: crypto.randomUUID(), title: "7시간 이상 자기", done: false },
    { id: crypto.randomUUID(), title: "아침 공복 유지", done: false },
    { id: crypto.randomUUID(), title: "운동 20분", done: false },
    { id: crypto.randomUUID(), title: "독서 10분", done: false },
  ];
}

function init() {
  const tk = todayKey();
  let state = loadState();

  if (!state) {
    state = { createdAt: Date.now(), streak: 0, lastCompleteDay: null, days: {} };
  }

  // 오늘 데이터 없으면 생성(템플릿 복사)
  if (!state.days[tk]) {
    state.days[tk] = { tasks: defaultTasks(), completed: false };
  }

  // 날짜 표시
  const d = new Date();
  document.getElementById("dateText").textContent =
    d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });

  // 렌더
  render(state, tk);

  // 이벤트
  document.getElementById("addBtn").addEventListener("click", () => {
    const input = document.getElementById("newTask");
    const title = input.value.trim();
    if (!title) return;
    state.days[tk].tasks.push({ id: crypto.randomUUID(), title, done: false });
    input.value = "";
    saveState(state);
    render(state, tk);
  });

  document.getElementById("newTask").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("addBtn").click();
  });

  document.getElementById("resetTodayBtn").addEventListener("click", () => {
    state.days[tk].tasks = state.days[tk].tasks.map(t => ({ ...t, done: false }));
    state.days[tk].completed = false;
    saveState(state);
    render(state, tk);
  });

  document.getElementById("resetAllBtn").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  // Service Worker 등록(PWA 오프라인)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function render(state, tk) {
  const tasks = state.days[tk].tasks;
  const list = document.getElementById("list");
  list.innerHTML = "";

  let doneCount = tasks.filter(t => t.done).length;
  const total = tasks.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  // 진행률
  document.getElementById("pctText").textContent = `${pct}%`;
  document.getElementById("countText").textContent = `${doneCount} / ${total}`;
  document.getElementById("barFill").style.width = `${pct}%`;

  // 링(둘레 2πr, r=42 => 약 263.89)
  const C = 264;
  const offset = C - (C * pct / 100);
  const ring = document.getElementById("ringFg");
  ring.style.strokeDasharray = String(C);
  ring.style.strokeDashoffset = String(offset);

  // 스트릭 표시(오늘 100% 달성 시 증가)
  const isComplete = total > 0 && doneCount === total;
  const streakEl = document.getElementById("streakText");

  if (isComplete && !state.days[tk].completed) {
    // 오늘 처음 완주했을 때만 streak 처리
    const prev = state.lastCompleteDay;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yk = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,"0")}-${String(yesterday.getDate()).padStart(2,"0")}`;

    if (prev === yk || prev === null) state.streak += 1;
    else state.streak = 1;

    state.lastCompleteDay = tk;
    state.days[tk].completed = true;
    saveState(state);
  }

  streakEl.textContent = `🔥 연속 ${state.streak}일`;

  // 리스트
  tasks.forEach((t) => {
    const li = document.createElement("li");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = t.done;
    cb.addEventListener("change", () => {
      t.done = cb.checked;
      saveState(state);
      render(state, tk);
    });

    const span = document.createElement("div");
    span.className = "task" + (t.done ? " done" : "");
    span.textContent = t.title;

    const del = document.createElement("button");
    del.textContent = "삭제";
    del.addEventListener("click", () => {
      state.days[tk].tasks = state.days[tk].tasks.filter(x => x.id !== t.id);
      saveState(state);
      render(state, tk);
    });

    li.appendChild(cb);
    li.appendChild(span);
    li.appendChild(del);
    list.appendChild(li);
  });
}

init();