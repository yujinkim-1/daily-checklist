// app.js (FULL)
// - Daily checklist with progress ring + streak
// - Editable Template (defaults for new days)
// - "Apply template to today" button
// - Fake widget-like summary (top 3 remaining) + toggle details (hide/show list)

const STORAGE_KEY = "daily-checklist-v3";

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
  // ✅ 여기만 바꾸면 “기본 체크 항목(템플릿)” 기본값이 바뀜
  return [
    makeTask("🥬 디톡스 스무디 + 유산균"),
    makeTask("💊 점심 먹고 영양제"),
    makeTask("✍️ 아침 출근길 글 하나"),
    makeTask("🌅 아침 공복 유지"),
    makeTask("🚫🍪 간식 참기"),
    makeTask("🥜 건강한 간식"),
    makeTask("🥗 저녁 식단"),
    makeTask("🏃 운동"),
    makeTask("🎧 강의 하나 듣기"),
  ];
}

/**
 * Fake widget summary renderer
 * - Shows top 3 remaining tasks
 * - If all done -> congrats message
 */
function renderWidget(state, tk) {
  const tasks = state.days?.[tk]?.tasks || [];
  const remaining = tasks.filter((t) => !t.done);
  const top3 = remaining.slice(0, 3);

  const sub = document.getElementById("widgetSub");
  const list = document.getElementById("widgetList");

  // 위젯 영역이 index.html에 없으면 조용히 종료
  if (!sub || !list) return;

  sub.textContent = `남은 할 일 ${remaining.length}개`;
  list.innerHTML = "";

  if (top3.length === 0) {
    const msg = document.createElement("div");
    msg.className = "muted";
    msg.textContent = "🎉 오늘 루틴 완료! 너무 좋다";
    list.appendChild(msg);
    return;
  }

  top3.forEach((t, idx) => {
    const row = document.createElement("div");
    row.className = "widgetItem";

    const left = document.createElement("div");
    left.className = "widgetLeft";

    const pill = document.createElement("div");
    pill.className = "pill";
    pill.textContent = `#${idx + 1}`;

    const title = document.createElement("div");
    title.textContent = t.title;

    left.appendChild(pill);
    left.appendChild(title);

    const go = document.createElement("div");
    go.className = "muted";
    go.textContent = "→";

    row.appendChild(left);
    row.appendChild(go);

    // 클릭하면 아래 리스트로 스크롤(있으면)
    row.addEventListener("click", () => {
      const ul = document.getElementById("list");
      if (ul) ul.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    list.appendChild(row);
  });
}

function render(state, tk) {
  const tasks = state.days[tk].tasks;
  const list = document.getElementById("list");
  if (!list) return;

  list.innerHTML = "";

  const doneCount = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  // progress texts
  const pctText = document.getElementById("pctText");
  const countText = document.getElementById("countText");
  const barFill = document.getElementById("barFill");
  if (pctText) pctText.textContent = `${pct}%`;
  if (countText) countText.textContent = `${doneCount} / ${total}`;
  if (barFill) barFill.style.width = `${pct}%`;

  // progress ring
  const C = 264;
  const offset = C - (C * pct) / 100;
  const ring = document.getElementById("ringFg");
  if (ring) {
    ring.style.strokeDasharray = String(C);
    ring.style.strokeDashoffset = String(offset);
  }

  // streak logic: count only when first time completing 100% for the day
  const isComplete = total > 0 && doneCount === total;
  if (isComplete && !state.days[tk].completed) {
    const prev = state.lastCompleteDay;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yk = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(
      yesterday.getDate()
    ).padStart(2, "0")}`;

    if (prev === yk || prev === null) state.streak += 1;
    else state.streak = 1;

    state.lastCompleteDay = tk;
    state.days[tk].completed = true;
    saveState(state);
  }

  const streakText = document.getElementById("streakText");
  if (streakText) streakText.textContent = `🔥 연속 ${state.streak}일`;

  // render list
  tasks.forEach((t) => {
    const li = document.createElement("li");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = t.done;
    cb.addEventListener("change", () => {
      t.done = cb.checked;
      // 오늘 완료 플래그는 “처음 완주”에만 쓰니, 체크 변경 시 false로 되돌려서 재평가 가능하게 함
      state.days[tk].completed = false;
      saveState(state);
      render(state, tk);
      renderTemplate(state);
    });

    const span = document.createElement("div");
    span.className = "task" + (t.done ? " done" : "");
    span.textContent = t.title;

    const del = document.createElement("button");
    del.textContent = "삭제";
    del.addEventListener("click", () => {
      state.days[tk].tasks = state.days[tk].tasks.filter((x) => x.id !== t.id);
      state.days[tk].completed = false;
      saveState(state);
      render(state, tk);
    });

    li.appendChild(cb);
    li.appendChild(span);
    li.appendChild(del);
    list.appendChild(li);
  });

  // ✅ fake widget summary update
  renderWidget(state, tk);
}

function renderTemplate(state) {
  const tplList = document.getElementById("tplList");
  if (!tplList) return;

  tplList.innerHTML = "";

  state.template.forEach((t) => {
    const li = document.createElement("li");

    // small handle
    const dot = document.createElement("div");
    dot.textContent = "⋮⋮";
    dot.style.opacity = ".6";
    dot.style.padding = "0 6px";

    const input = document.createElement("input");
    input.value = t.title;
    input.maxLength = 60;

    // ✅ 파스텔 테마용 (흰 글씨 방지)
    input.style.flex = "1";
    input.style.padding = "10px 12px";
    input.style.borderRadius = "12px";
    input.style.border = "1px solid rgba(124,92,255,.18)";
    input.style.background = "rgba(255,255,255,.85)";
    input.style.color = "#1f1f2a";

    input.addEventListener("change", () => {
      const v = input.value.trim();
      if (v) t.title = v;
      saveState(state);
      // 위젯도 텍스트 변경 반영
      renderWidget(state, todayKey());
    });

    const del = document.createElement("button");
    del.textContent = "삭제";
    del.addEventListener("click", () => {
      state.template = state.template.filter((x) => x.id !== t.id);
      saveState(state);
      renderTemplate(state);
      renderWidget(state, todayKey());
    });

    li.appendChild(dot);
    li.appendChild(input);
    li.appendChild(del);
    tplList.appendChild(li);
  });
}

function init() {
  const tk = todayKey();
  let state = loadState();

  // state shape
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

  // Ensure template exists
  if (!Array.isArray(state.template) || state.template.length === 0) {
    state.template = defaultTemplate();
  }

  // Create today's tasks from template if not exists
  if (!state.days[tk]) {
    state.days[tk] = {
      tasks: state.template.map((t) => makeTask(t.title)),
      completed: false,
    };
  }

  // Date text
  const dateText = document.getElementById("dateText");
  if (dateText) {
    const d = new Date();
    dateText.textContent = d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  }

  // Initial render
  render(state, tk);
  renderTemplate(state);

  // ✅ Toggle details (hide/show main checklist list)
  const toggleBtn = document.getElementById("toggleDetailsBtn");
  const listEl = document.getElementById("list");
  if (toggleBtn && listEl) {
    // default: collapsed for "widget feel"
    listEl.style.display = "none";
    toggleBtn.textContent = "자세히";

    toggleBtn.addEventListener("click", () => {
      const isHidden = listEl.style.display === "none";
      listEl.style.display = isHidden ? "" : "none";
      toggleBtn.textContent = isHidden ? "접기" : "자세히";
    });
  }

  // Add today task
  const addBtn = document.getElementById("addBtn");
  const newTask = document.getElementById("newTask");
  if (addBtn && newTask) {
    addBtn.addEventListener("click", () => {
      const title = newTask.value.trim();
      if (!title) return;

      state.days[tk].tasks.push(makeTask(title));
      state.days[tk].completed = false;

      newTask.value = "";
      saveState(state);
      render(state, tk);
    });

    newTask.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addBtn.click();
    });
  }

  // Add template task
  const addTplBtn = document.getElementById("addTplBtn");
  const newTplTask = document.getElementById("newTplTask");
  if (addTplBtn && newTplTask) {
    addTplBtn.addEventListener("click", () => {
      const title = newTplTask.value.trim();
      if (!title) return;

      state.template.push(makeTask(title));
      newTplTask.value = "";

      saveState(state);
      renderTemplate(state);
      // 위젯도 갱신
      renderWidget(state, tk);
    });

    newTplTask.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addTplBtn.click();
    });
  }

  // Apply template to today
  const applyTemplateBtn = document.getElementById("applyTemplateTodayBtn");
  if (applyTemplateBtn) {
    applyTemplateBtn.addEventListener("click", () => {
      state.days[tk].tasks = state.template.map((t) => makeTask(t.title));
      state.days[tk].completed = false;

      saveState(state);
      render(state, tk);
    });
  }

  // Reset today
  const resetTodayBtn = document.getElementById("resetTodayBtn");
  if (resetTodayBtn) {
    resetTodayBtn.addEventListener("click", () => {
      state.days[tk].tasks = state.days[tk].tasks.map((t) => ({ ...t, done: false }));
      state.days[tk].completed = false;

      saveState(state);
      render(state, tk);
    });
  }

  // Reset all
  const resetAllBtn = document.getElementById("resetAllBtn");
  if (resetAllBtn) {
    resetAllBtn.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    });
  }

  // Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

init();