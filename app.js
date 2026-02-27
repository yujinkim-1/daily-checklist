const STORAGE_KEY = "daily-checklist-v2"; // v1 -> v2 (구조 변경)

function todayKey() {
  const d = new Date();
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

function makeTask(title) {
  return { id: crypto.randomUUID(), title, done: false };
}

function defaultTemplate() {
  return [
    makeTask("😴 7시간 이상 자기"),
    makeTask("🥣 아침 공복 유지"),
    makeTask("🏃 운동 20분"),
    makeTask("📚 독서 10분"),
  ];
}

function init() {
  const tk = todayKey();
  let state = loadState();

  // state 구조:
  // {
  //   createdAt,
  //   streak,
  //   lastCompleteDay,
  //   template: [tasks...],
  //   days: { "YYYY-MM-DD": { tasks:[...], completed:false } }
  // }

  if (!state) {
    state = {
      createdAt: Date.now(),
      streak: 0,
      lastCompleteDay: null,
      template: defaultTemplate(),
      days: {},
    };
  }

  // template 없으면 채우기(기존 데이터 보호)
  if (!Array.isArray(state.template) || state.template.length === 0) {
    state.template = defaultTemplate();
  }

  // 오늘 데이터 없으면 template 복사
  if (!state.days[tk]) {
    state.days[tk] = {
      tasks: state.template.map(t => makeTask(t.title)),
      completed: false,
    };
  }

  // 날짜 표시
  const d = new Date();
  document.getElementById("dateText").textContent =
    d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });

  // 렌더
  render(state, tk);
  renderTemplate(state, tk);

  // 오늘 task 추가
  document.getElementById("addBtn").addEventListener("click", () => {
    const input = document.getElementById("newTask");
    const title = input.value.trim();
    if (!title) return;
    state.days[tk].tasks.push(makeTask(title));
    input.value = "";
    saveState(state);
    render(state, tk);
  });

  document.getElementById("newTask").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("addBtn").click();
  });

  // 템플릿 task 추가
  const tplInput = document.getElementById("newTplTask");
  const addTplBtn = document.getElementById("addTplBtn");
  addTplBtn.addEventListener("click", () => {
    const title = tplInput.value.trim();
    if (!title) return;
    state.template.push(makeTask(title));
    tplInput.value = "";
    saveState(state);
    renderTemplate(state, tk);
  });

  tplInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addTplBtn.click();
  });

  // 템플릿으로 오늘 덮어쓰기
  document.getElementById("applyTemplateTodayBtn").addEventListener("click", () => {
    state.days[tk].tasks = state.template.map(t => makeTask(t.title));
    state.days[tk].completed = false;
    saveState(state);
    render(state, tk);
  });

  // 오늘 초기화
  document.getElementById("resetTodayBtn").addEventListener("click", () => {
    state.days[tk].tasks = state.days[tk].tasks.map(t => ({ ...t, done: false }));
    state.days[tk].completed = false;
    saveState(state);
    render(state, tk);
  });

  // 전체 초기화
  document.getElementById("resetAllBtn").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  // Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function render(state, tk) {
  const tasks = state.days[tk].tasks;
  const list = document.getElementById("list");
  list.innerHTML = "";

  const doneCount = tasks.filter(t => t.done).length;
  const total = tasks.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  // 진행률 UI
  document.getElementById("pctText").textContent = `${pct}%`;
  document.getElementById("countText").textContent = `${doneCount} / ${total}`;
  document.getElementById("barFill").style.width = `${pct}%`;

  const C = 264;
  const offset = C - (C * pct / 100);
  const ring = document.getElementById("ringFg");
  ring.style.strokeDasharray = String(C);
  ring.style.strokeDashoffset = String(offset);

  // 스트릭 처리(오늘 100% 최초 달성 시)
  const isComplete = total > 0 && doneCount === total;
  if (isComplete && !state.days[tk].completed) {
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

  document.getElementById("streakText").textContent = `🔥 연속 ${state.streak}일`;

  // 오늘 리스트 렌더
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
      // 삭제 후 완료 상태 재평가
      state.days[tk].completed = false;
      saveState(state);
      render(state, tk);
    });

    li.appendChild(cb);
    li.appendChild(span);
    li.appendChild(del);
    list.appendChild(li);
  });
}

function renderTemplate(state, tk) {
  const tplList = document.getElementById("tplList");
  tplList.innerHTML = "";

  state.template.forEach((t) => {
    const li = document.createElement("li");

    // 템플릿은 체크박스 대신 핸들 느낌
    const dot = document.createElement("div");
    dot.textContent = "⋮⋮";
    dot.style.opacity = ".6";
    dot.style.padding = "0 6px";

    const input = document.createElement("input");
    input.value = t.title;
    input.maxLength = 60;
    input.style.flex = "1";
    input.style.padding = "10px 12px";
    input.style.borderRadius = "12px";
    input.style.border = "1px solid rgba(255,255,255,.12)";
    input.style.background = "rgba(255,255,255,.06)";
    input.style.color = "#fff";

    input.addEventListener("change", () => {
      t.title = input.value.trim() || t.title;
      saveState(state);
    });

    const del = document.createElement("button");
    del.textContent = "삭제";
    del.addEventListener("click", () => {
      state.template = state.template.filter(x => x.id !== t.id);
      saveState(state);
      renderTemplate(state, tk);
    });

    li.appendChild(dot);
    li.appendChild(input);
    li.appendChild(del);
    tplList.appendChild(li);
  });
}

init();