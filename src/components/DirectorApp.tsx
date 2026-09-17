"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, CalendarBlock, CalendarKind, DirectorPick, DirectorSettings, Energy, ImportSuggestion, ReminderStatus, Task, TaskKind, UpdateState } from "@/lib/types";
import { initialState, loadState, saveState } from "@/lib/store";
import { localDirectorPick } from "@/lib/scoring";

type View = "today" | "calendar" | "tasks" | "inbox" | "routines" | "chat" | "settings";
type PickMode = "work" | "stream" | "short" | "visual";

const nav: { id: View; label: string; icon: string }[] = [
  { id: "today", label: "Today", icon: "◉" },
  { id: "calendar", label: "Calendar", icon: "▦" },
  { id: "tasks", label: "Tasks", icon: "✓" },
  { id: "inbox", label: "Inbox", icon: "↓" },
  { id: "routines", label: "Routines", icon: "↻" },
  { id: "chat", label: "Chat", icon: "✦" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

const energyLabels: Record<Energy, string> = {
  full: "🔥 Full",
  normal: "🙂 Normal",
  low: "🥱 Low",
  dead: "💀 Dead",
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function DirectorApp() {
  const popup = new URLSearchParams(window.location.search).get("popup");
  return popup === "stream-prep" ? <StreamPrepPopup /> : <MainDirectorApp />;
}

function MainDirectorApp() {
  const [state, setState] = useState<AppState>(initialState);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("today");
  const [pick, setPick] = useState<DirectorPick | null>(null);
  const [pickMode, setPickMode] = useState<PickMode>("work");
  const [thinking, setThinking] = useState(false);
  const savingTimer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadState().then((next) => {
      if (!alive) return;
      setState(next);
      setLoaded(true);
    });
    window.directorBridge.onDataChanged(() => {
      loadState().then((next) => setState(next)).catch(() => undefined);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (savingTimer.current) window.clearTimeout(savingTimer.current);
    savingTimer.current = window.setTimeout(() => {
      saveState(state).catch((error) => console.error("Could not save Director state", error));
    }, 180);
    return () => {
      if (savingTimer.current) window.clearTimeout(savingTimer.current);
    };
  }, [state, loaded]);

  const activeTasks = useMemo(() => state.tasks.filter((t) => !["done", "archived", "inbox"].includes(t.status)), [state.tasks]);
  const completedToday = useMemo(() => {
    const today = new Date().toDateString();
    return state.tasks.filter((t) => t.completedAt && new Date(t.completedAt).toDateString() === today).length;
  }, [state.tasks]);

  async function askDirector(mode: PickMode = pickMode) {
    setPickMode(mode);
    setThinking(true);
    try {
      const data = await window.directorBridge.pick(state, mode);
      const candidate = data.pick;
      if (candidate?.taskId && state.tasks.some((t) => t.id === candidate.taskId)) setPick(candidate);
      else setPick(localDirectorPick(state, mode));
    } catch {
      setPick(localDirectorPick(state, mode));
    } finally {
      setThinking(false);
    }
  }

  function updateTask(id: string, patch: Partial<Task>) {
    setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }

  function startPick() {
    if (!pick) return;
    updateTask(pick.taskId, { status: "active", completedAt: undefined, archivedAt: undefined });
  }

  function finishPick() {
    if (!pick) return;
    updateTask(pick.taskId, { status: "done", completedAt: new Date().toISOString(), archivedAt: undefined });
    setPick(null);
  }

  function deferPick(reason: string, hours: number) {
    if (!pick) return;
    updateTask(pick.taskId, {
      status: "deferred",
      deferReason: reason.trim() || "Life happened",
      deferredUntil: new Date(Date.now() + hours * 3_600_000).toISOString(),
    });
    setPick(null);
  }

  if (!loaded) {
    return <div className="loading-screen"><span className="brand-mark">D</span><p>Opening Director database…</p></div>;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">D</span><div><strong>DIRECTOR</strong><small>personal operating system</small></div></div>
        <nav>
          {nav.map((item) => (
            <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => setView(item.id)}>
              <span>{item.icon}</span>{item.label}
              {item.id === "tasks" && <em>{activeTasks.length}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /> SQLite + Tray <small>закрытие окна оставляет Director в фоне</small></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><div className="eyebrow">{new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</div><h1>{nav.find((n) => n.id === view)?.label}</h1></div>
          <EnergyPicker value={state.energy} onChange={(energy) => setState((s) => ({ ...s, energy }))} />
        </header>

        {view === "today" && (
          <TodayView
            state={state}
            completedToday={completedToday}
            pick={pick}
            thinking={thinking}
            mode={pickMode}
            askDirector={askDirector}
            startPick={startPick}
            finishPick={finishPick}
            deferPick={deferPick}
            setView={setView}
            updateTask={updateTask}
          />
        )}
        {view === "calendar" && <CalendarView state={state} setState={setState} />}
        {view === "tasks" && <TasksView state={state} setState={setState} />}
        {view === "inbox" && <InboxView state={state} setState={setState} />}
        {view === "routines" && <RoutinesView state={state} setState={setState} />}
        {view === "chat" && <ChatView state={state} setState={setState} />}
        {view === "settings" && <SettingsView />}
      </section>
    </main>
  );
}

function EnergyPicker({ value, onChange }: { value: Energy; onChange: (v: Energy) => void }) {
  return (
    <select className="energy-picker" value={value} onChange={(e) => onChange(e.target.value as Energy)}>
      {(Object.keys(energyLabels) as Energy[]).map((e) => <option key={e} value={e}>{energyLabels[e]}</option>)}
    </select>
  );
}

function TodayView({ state, completedToday, pick, thinking, mode, askDirector, startPick, finishPick, deferPick, setView, updateTask }: {
  state: AppState;
  completedToday: number;
  pick: DirectorPick | null;
  thinking: boolean;
  mode: PickMode;
  askDirector: (m?: PickMode) => void;
  startPick: () => void;
  finishPick: () => void;
  deferPick: (reason: string, hours: number) => void;
  setView: (v: View) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
}) {
  const active = state.tasks.find((t) => t.status === "active");
  const selectedTask = pick ? state.tasks.find((t) => t.id === pick.taskId) : undefined;
  const [showDefer, setShowDefer] = useState(false);
  const [deferReason, setDeferReason] = useState("Работа затянулась");

  function doDefer(hours: number) {
    deferPick(deferReason, hours);
    setShowDefer(false);
  }

  return (
    <div className="content-grid">
      <section className="director-card hero-card">
        <div className="section-label"><span className="spark">✦</span> DIRECTOR QUEUE</div>
        {!pick ? (
          <div className="empty-pick"><p>Не выбирай из пятидесяти пунктов. Скажи, какой сейчас режим — Director выберет одну задачу.</p><button className="primary big" onClick={() => askDirector("work")} disabled={thinking}>{thinking ? "Думаю…" : "WHAT SHOULD I DO?"}</button></div>
        ) : (
          <div className="pick-content">
            <small>NEXT TASK</small><h2>{pick.taskTitle}</h2>
            {pick.estimatedMinutes && <div className="time-chip">~ {formatMinutes(pick.estimatedMinutes)}</div>}
            <p className="why"><b>Почему:</b> {pick.why}</p>{pick.caution && <p className="caution">{pick.caution}</p>}
            {selectedTask && <InlineTaskChecklist task={selectedTask} updateTask={updateTask} />}
            <div className="actions"><button className="primary" onClick={startPick}>▶ Start</button><button onClick={finishPick}>✓ Done</button><button onClick={() => askDirector(mode)}>Another one</button><button onClick={() => setShowDefer(true)}>Life happened</button></div>
            {showDefer && <div className="defer-box"><label><span>Что произошло?</span><input value={deferReason} onChange={(e) => setDeferReason(e.target.value)} /></label><div className="actions"><button onClick={() => doDefer(2)}>Через 2 часа</button><button onClick={() => doDefer(24)}>Завтра</button><button onClick={() => doDefer(72)}>Через 3 дня</button><button className="text-button" onClick={() => setShowDefer(false)}>Отмена</button></div></div>}
          </div>
        )}
        <div className="mode-row">
          <button className={mode === "work" ? "mode active" : "mode"} onClick={() => askDirector("work")}>🧠 Focus</button>
          <button className={mode === "stream" ? "mode active" : "mode"} onClick={() => askDirector("stream")}>📺 Stream</button>
          <button className={mode === "short" ? "mode active" : "mode"} onClick={() => askDirector("short")}>⚡ 30 min</button>
          <button className={mode === "visual" ? "mode active" : "mode"} onClick={() => askDirector("visual")}>🎨 Visual</button>
        </div>
      </section>

      <section className="stat-row">
        <div className="stat"><small>ENERGY</small><strong>{energyLabels[state.energy]}</strong></div>
        <div className="stat"><small>OPEN TASKS</small><strong>{state.tasks.filter((t) => !["done", "archived", "inbox"].includes(t.status)).length}</strong></div>
        <div className="stat"><small>DONE TODAY</small><strong>{completedToday}</strong></div>
      </section>

      {active && <section className="panel active-task-card">
        <div className="active-task">
          <div><small>NOW WORKING ON</small><h3>{active.title}</h3></div>
          <div className="actions"><button className="primary" onClick={() => updateTask(active.id, { status: "done", completedAt: new Date().toISOString(), archivedAt: undefined })}>✓ Done</button><button onClick={() => updateTask(active.id, { status: "todo", completedAt: undefined })}>Stop</button></div>
        </div>
        <InlineTaskChecklist task={active} updateTask={updateTask} compact />
      </section>}

      <TodaySchedule blocks={state.calendarBlocks} onOpenCalendar={() => setView("calendar")} />

      <section className="panel"><div className="panel-head"><div><small>ROUTINE</small><h3>Stream Prep</h3></div><div className="actions"><button className="text-button" onClick={() => window.directorBridge.openStreamPrep()}>Open popup</button><button className="text-button" onClick={() => setView("routines")}>Edit →</button></div></div>{state.routines.find((r) => r.id === "stream-prep")?.items.slice(0, 5).map((item) => <div key={item.id} className="mini-check"><span className={item.checked ? "check checked" : "check"}>{item.checked ? "✓" : ""}</span><span>{item.text}</span></div>)}</section>
    </div>
  );
}

function InlineTaskChecklist({ task, updateTask, compact = false }: { task: Task; updateTask: (id: string, patch: Partial<Task>) => void; compact?: boolean }) {
  const checklist = task.checklist || [];
  if (!checklist.length) return null;
  const done = checklist.filter((item) => item.checked).length;

  function toggle(id: string) {
    updateTask(task.id, {
      checklist: checklist.map((item) => item.id === id ? { ...item, checked: !item.checked } : item),
    });
  }

  return (
    <div className={compact ? "inline-task-checklist compact" : "inline-task-checklist"}>
      <div className="inline-checklist-head"><small>CHECKLIST</small><strong>{done}/{checklist.length}</strong></div>
      <div className="inline-checklist-items">
        {checklist.map((item) => (
          <button key={item.id} className={item.checked ? "inline-check-item checked" : "inline-check-item"} onClick={() => toggle(item.id)}>
            <span className={item.checked ? "check checked" : "check"}>{item.checked ? "✓" : ""}</span>
            <span>{item.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function sanitizeClassification(classification: Partial<Task>): Partial<Task> {
  return {
    kind: classification.kind,
    taskType: classification.taskType,
    project: classification.project,
    area: classification.area,
    chapter: classification.chapter,
    feature: classification.feature,
    tags: classification.tags,
    estimateMinutes: classification.estimateMinutes,
    streamFriendly: classification.streamFriendly,
    visual: classification.visual,
    deepWork: classification.deepWork,
    blocking: classification.blocking,
    classificationReason: classification.classificationReason,
    classificationConfidence: classification.classificationConfidence,
  };
}


function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function shiftDateKey(key: string, delta: number) {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + delta);
  return localDateKey(d);
}

function minutesOfDay(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function TodaySchedule({ blocks, onOpenCalendar }: { blocks: CalendarBlock[]; onOpenCalendar: () => void }) {
  const today = localDateKey();
  const items = blocks.filter((b) => b.date === today).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const next = items.find((b) => minutesOfDay(b.endTime) > nowMin);
  const freeUntil = next && minutesOfDay(next.startTime) > nowMin ? minutesOfDay(next.startTime) - nowMin : null;
  return <section className="panel today-schedule"><div className="panel-head"><div><small>CALENDAR</small><h3>Сегодня</h3></div><button className="text-button" onClick={onOpenCalendar}>Open →</button></div>{items.length === 0 ? <p className="settings-copy">На сегодня ничего не забито. Director считает день свободным, пока ты не добавишь блоки.</p> : <div className="schedule-list">{items.map((b) => <div className="schedule-row" key={b.id}><span className={`calendar-dot kind-${b.kind}`} /><strong>{b.startTime}–{b.endTime}</strong><div><b>{b.title}</b><small>{b.kind}</small></div></div>)}</div>}{freeUntil !== null && freeUntil > 0 && <div className="free-window">Свободное окно до следующего блока: <b>~{freeUntil} мин</b></div>}</section>;
}

function CalendarView({ state, setState }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [date, setDate] = useState(localDateKey());
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("20:00");
  const [kind, setKind] = useState<CalendarKind>("reytrieve");
  const [notes, setNotes] = useState("");
  const selectedDate = parseDateKey(date);
  const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const monthLabel = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(monthStart);
  const blocks = state.calendarBlocks.filter((b) => b.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime));

  const calendarDays = useMemo(() => {
    const first = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + index);
      const key = localDateKey(d);
      return {
        key,
        day: d.getDate(),
        inMonth: d.getMonth() === monthStart.getMonth(),
        today: key === localDateKey(),
        blocks: state.calendarBlocks.filter((b) => b.date === key),
      };
    });
  }, [monthStart.getFullYear(), monthStart.getMonth(), state.calendarBlocks]);

  function shiftMonth(delta: number) {
    const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + delta, 1);
    setDate(localDateKey(d));
  }

  function addBlock() {
    const clean = title.trim();
    if (!clean || endTime <= startTime) return;
    const block: CalendarBlock = { id: uid(), title: clean, date, startTime, endTime, kind, notes: notes.trim() || undefined, createdAt: new Date().toISOString() };
    setState((s) => ({ ...s, calendarBlocks: [...s.calendarBlocks, block] }));
    setTitle(""); setNotes("");
  }

  function removeBlock(id: string) {
    setState((s) => ({ ...s, calendarBlocks: s.calendarBlocks.filter((b) => b.id !== id) }));
  }

  const dayLabel = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(selectedDate);
  return (
    <div className="page-stack calendar-page">
      <section className="panel month-calendar">
        <div className="calendar-toolbar">
          <div><small>MONTH</small><h2>{monthLabel}</h2></div>
          <div className="actions"><button onClick={() => shiftMonth(-1)}>←</button><button onClick={() => setDate(localDateKey())}>Today</button><input className="calendar-date-jump" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /><button onClick={() => shiftMonth(1)}>→</button></div>
        </div>
        <div className="month-weekdays">{weekdayLabels.map((d) => <span key={d}>{d}</span>)}</div>
        <div className="month-grid">
          {calendarDays.map((cell) => (
            <button key={cell.key} className={`month-day ${cell.inMonth ? "" : "outside"} ${cell.key === date ? "selected" : ""} ${cell.today ? "today" : ""}`} onClick={() => setDate(cell.key)}>
              <span className="month-day-number">{cell.day}</span>
              <span className="month-day-events">
                {cell.blocks.slice(0, 3).map((block) => <i key={block.id} className={`month-event-dot kind-${block.kind}`} title={`${block.startTime} ${block.title}`} />)}
                {cell.blocks.length > 3 && <small>+{cell.blocks.length - 3}</small>}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="calendar-grid">
        <div className="panel">
          <div className="panel-head"><div><small>DAY PLAN</small><h3>{dayLabel}</h3></div><span className="source-pill">{blocks.length}</span></div>
          {blocks.length === 0 ? <p className="settings-copy">Пусто. Выбери другой день в календаре или добавь блок справа.</p> : <div className="calendar-block-list">{blocks.map((b) => <div className="calendar-block" key={b.id}><span className={`calendar-dot kind-${b.kind}`} /><div className="calendar-time"><strong>{b.startTime}</strong><small>{b.endTime}</small></div><div className="calendar-block-copy"><strong>{b.title}</strong><div className="task-meta"><span>{b.kind}</span>{b.id.startsWith("auto-stream:") && <span>recurring</span>}{b.notes && <span>{b.notes}</span>}</div></div>{!b.id.startsWith("auto-stream:") ? <button className="danger-text" onClick={() => removeBlock(b.id)}>×</button> : <span />}</div>)}</div>}
        </div>
        <div className="panel calendar-add">
          <div className="panel-head"><div><small>ADD BLOCK</small><h3>Забить время</h3></div></div>
          <label><span>Что происходит</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Работа / стрим / Reytrieve…" /></label>
          <div className="two-col"><label><span>Начало</span><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label><label><span>Конец</span><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label></div>
          <label><span>Тип</span><select value={kind} onChange={(e) => setKind(e.target.value as CalendarKind)}><option value="work">Work</option><option value="reytrieve">Reytrieve</option><option value="stream">Stream</option><option value="personal">Personal</option><option value="admin">Admin</option><option value="other">Other</option></select></label>
          <label><span>Заметка</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="необязательно" /></label>
          {endTime <= startTime && <p className="duplicate-warning">Конец должен быть позже начала.</p>}
          <button className="primary" disabled={!title.trim() || endTime <= startTime} onClick={addBlock}>Add to calendar</button>
        </div>
      </section>
    </div>
  );
}
function TasksView({ state, setState }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState<"active" | "completed" | "archive" | "all">("active");
  const [classifyingId, setClassifyingId] = useState<string | null>(null);

  async function addTask() {
    if (!title.trim()) return;
    const text = title.trim();
    const id = uid();
    const task: Task = { id, title: text, status: "todo", kind: "dev", source: "manual", createdAt: new Date().toISOString() };
    setState((s) => ({ ...s, tasks: [task, ...s.tasks] }));
    setTitle("");
    setClassifyingId(id);
    try {
      const result = await window.directorBridge.classifyTask(text, state.tasks);
      if (result.classification) {
        const patch = sanitizeClassification(result.classification);
        setState((s) => ({ ...s, tasks: s.tasks.map((t) => t.id === id ? { ...t, ...patch } : t) }));
      }
    } finally {
      setClassifyingId(null);
    }
  }

  const tasks = state.tasks.filter((task) => {
    if (task.status === "inbox") return false;
    if (filter === "completed") return task.status === "done";
    if (filter === "archive") return task.status === "archived";
    if (filter === "active") return !["done", "archived"].includes(task.status);
    return true;
  });

  const counts = {
    active: state.tasks.filter((task) => !["done", "archived", "inbox"].includes(task.status)).length,
    completed: state.tasks.filter((task) => task.status === "done").length,
    archive: state.tasks.filter((task) => task.status === "archived").length,
    all: state.tasks.filter((task) => task.status !== "inbox").length,
  };

  const labels: Record<typeof filter, string> = {
    active: "Active",
    completed: "Completed",
    archive: "Archive",
    all: "All",
  };

  return (
    <div className="page-stack">
      <section className="quick-add"><input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void addTask()} placeholder="Просто напиши задачу. Важность и контекст Director разберёт сам." /><button className="primary" onClick={() => void addTask()}>+ Add</button></section>
      <div className="filter-row">{(["active", "completed", "archive", "all"] as const).map((f) => <button key={f} className={filter === f ? "chip active" : "chip"} onClick={() => setFilter(f)}>{labels[f]} <span className="chip-count">{counts[f]}</span></button>)}{classifyingId && <span className="inline-status">Director разбирает новую задачу…</span>}</div>
      <section className="task-list">
        {tasks.map((task) => <TaskRow key={task.id} task={task} update={(patch) => setState((s) => ({ ...s, tasks: s.tasks.map((t) => t.id === task.id ? { ...t, ...patch } : t) }))} remove={() => setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== task.id) }))} />)}
        {!tasks.length && <div className="empty-list">{filter === "archive" ? "Архив пуст. Сюда можно убирать отменённые и больше не актуальные задачи." : filter === "completed" ? "Пока нет завершённых задач." : "Здесь пока пусто."}</div>}
      </section>
    </div>
  );
}

function TaskRow({ task, update, remove }: { task: Task; update: (p: Partial<Task>) => void; remove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [newItem, setNewItem] = useState("");
  const deferredText = task.status === "deferred" && task.deferredUntil ? `до ${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(task.deferredUntil))}` : undefined;
  const checklist = task.checklist || [];
  const doneCount = checklist.filter((item) => item.checked).length;
  const isDone = task.status === "done";
  const isArchived = task.status === "archived";

  function addChecklistItem() {
    const text = newItem.trim();
    if (!text) return;
    update({ checklist: [...checklist, { id: uid(), text, checked: false }] });
    setNewItem("");
  }

  function patchChecklistItem(id: string, patch: { text?: string; checked?: boolean }) {
    update({ checklist: checklist.map((item) => item.id === id ? { ...item, ...patch } : item) });
  }

  function removeChecklistItem(id: string) {
    update({ checklist: checklist.filter((item) => item.id !== id) });
  }

  function setStatus(status: Task["status"]) {
    if (status === "done") {
      update({ status, completedAt: new Date().toISOString(), archivedAt: undefined });
      return;
    }
    if (status === "archived") {
      update({ status, archivedAt: new Date().toISOString(), completedAt: undefined, deferredUntil: undefined, deferReason: undefined });
      return;
    }
    update({ status, completedAt: undefined, archivedAt: undefined });
  }

  function confirmRemove() {
    if (window.confirm(`Удалить задачу навсегда?\n\n${task.title}`)) remove();
  }

  return (
    <div className={`task-row-wrap ${isDone ? "done" : ""} ${isArchived ? "archived" : ""}`}>
      <div className="task-row">
        {isArchived ? (
          <button className="task-check restore-check" title="Restore" onClick={() => setStatus("todo")}>↺</button>
        ) : (
          <button className={isDone ? "task-check checked" : "task-check"} onClick={() => setStatus(isDone ? "todo" : "done")}>{isDone ? "✓" : ""}</button>
        )}
        <div className="task-main" onClick={() => setExpanded((v) => !v)}>
          <strong>{task.title}</strong>
          <div className="task-meta">{task.project && <span>{task.project}</span>}{task.chapter && <span>{task.chapter}</span>}{task.area && <span>{task.area}</span>}{task.feature && <span>{task.feature}</span>}{task.taskType && <span>{task.taskType}</span>}{task.estimateMinutes && <span>~{formatMinutes(task.estimateMinutes)}</span>}{task.blocking && <span className="meta-hot">blocker</span>}{task.streamFriendly && <span>stream</span>}{checklist.length > 0 && <span>☑ {doneCount}/{checklist.length}</span>}{deferredText && <span>deferred {deferredText}</span>}{isArchived && <span>archived</span>}</div>
          {task.notes && <p className="task-note-preview">{task.notes}</p>}
        </div>
        <button className="task-details-button" onClick={() => setExpanded((v) => !v)}>{expanded ? "Close" : "Details"}</button>
        {isArchived ? <button onClick={() => setStatus("todo")}>Restore</button> : <button onClick={() => setStatus("archived")}>Archive</button>}
        <select value={task.status} onChange={(e) => setStatus(e.target.value as Task["status"])}><option value="todo">Todo</option><option value="active">Active</option><option value="deferred">Deferred</option><option value="done">Done</option><option value="archived">Archived</option></select>
        <button className="danger-text" title="Delete permanently" onClick={confirmRemove}>×</button>
      </div>
      {expanded && <div className="task-details">
        <div className="task-structure-grid">
          <label><span>Project</span><input value={task.project || ""} onChange={(e) => update({ project: e.target.value || undefined })} placeholder="Reytrieve Odyssey" /></label>
          <label><span>Chapter</span><input value={task.chapter || ""} onChange={(e) => update({ chapter: e.target.value || undefined })} placeholder="Chapter 1" /></label>
          <label><span>Area / Act</span><input value={task.area || ""} onChange={(e) => update({ area: e.target.value || undefined })} placeholder="Act 4 — Bag Shop" /></label>
          <label><span>Feature / Group</span><input value={task.feature || ""} onChange={(e) => update({ feature: e.target.value || undefined })} placeholder="HUB Items / Boss / UI…" /></label>
        </div>
        <label><span>Описание / заметки</span><textarea value={task.notes || ""} onChange={(e) => update({ notes: e.target.value })} placeholder="Что именно надо сделать, ссылки, детали, мысли…" /></label>
        <div className="task-checklist-head"><div><small>CHECKLIST</small><strong>{doneCount}/{checklist.length}</strong></div><div className="actions">{isArchived ? <button onClick={() => setStatus("todo")}>↺ Restore to Active</button> : <button onClick={() => setStatus("archived")}>Archive task</button>}</div></div>
        <div className="task-subtasks">
          {checklist.map((item) => <div className="task-subtask" key={item.id}><button className={item.checked ? "task-check checked" : "task-check"} onClick={() => patchChecklistItem(item.id, { checked: !item.checked })}>{item.checked ? "✓" : ""}</button><input value={item.text} onChange={(e) => patchChecklistItem(item.id, { text: e.target.value })} /><button className="danger-text" onClick={() => removeChecklistItem(item.id)}>×</button></div>)}
          {!checklist.length && <p className="settings-copy">Можно разбить задачу на маленькие шаги. Это не отдельные задачи Director — это чеклист внутри неё.</p>}
        </div>
        <div className="task-subtask-add"><input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addChecklistItem()} placeholder="Добавить пункт чеклиста…" /><button onClick={addChecklistItem}>+ Add</button></div>
        {task.classificationReason && <p className="task-reason"><b>Director:</b> {task.classificationReason}</p>}
      </div>}
    </div>
  );
}
function InboxView({ state, setState }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [raw, setRaw] = useState("");
  const [sourceName, setSourceName] = useState("Paste / raw backlog");
  const [suggestions, setSuggestions] = useState<ImportSuggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);

  async function chooseFile() {
    const result = await window.directorBridge.chooseImportFile();
    if (result.error) { setSummary(result.error); return; }
    if (!result.canceled && result.text !== undefined) {
      setRaw(result.text);
      setSourceName(result.name || "Imported file");
      setSuggestions([]);
      setSummary("");
    }
  }

  async function analyze() {
    if (!raw.trim() || analyzing) return;
    setAnalyzing(true);
    try {
      const result = await window.directorBridge.analyzeImport(raw, state.tasks);
      setSuggestions(result.suggestions);
      setAiUsed(result.aiUsed);
      setSummary(result.summary || "");
      setSelected(new Set(result.suggestions.filter((s) => !s.possibleDuplicateTaskId).map((s) => s.tempId)));
    } finally {
      setAnalyzing(false);
    }
  }

  function toggle(tempId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(tempId)) next.delete(tempId); else next.add(tempId);
      return next;
    });
  }

  function importSelected() {
    const now = new Date().toISOString();
    const tasks: Task[] = suggestions.filter((s) => selected.has(s.tempId)).map((s) => ({
      id: uid(),
      title: s.title,
      notes: s.notes,
      status: "todo",
      kind: s.kind || "dev",
      taskType: s.taskType,
      project: s.project,
      area: s.area,
      chapter: s.chapter,
      feature: s.feature,
      tags: s.tags,
      estimateMinutes: s.estimateMinutes,
      streamFriendly: s.streamFriendly,
      visual: s.visual,
      deepWork: s.deepWork,
      blocking: s.blocking,
      classificationReason: s.reason,
      source: "import",
      createdAt: now,
    }));
    if (!tasks.length) return;
    setState((s) => ({ ...s, tasks: [...tasks, ...s.tasks] }));
    setSummary(`Импортировано ${tasks.length} задач. Ничего из исходного списка автоматически не удалялось.`);
    setSuggestions([]);
    setSelected(new Set());
    setRaw("");
  }

  return (
    <div className="page-stack">
      <section className="panel import-card">
        <div className="panel-head"><div><small>RAW INBOX</small><h2>Свали сюда весь бардак</h2></div><button onClick={() => void chooseFile()}>Choose file</button></div>
        <p className="settings-copy">Поддерживаются TXT, Markdown, CSV, TSV и JSON. Director сначала покажет разбор и возможные дубли — в базу попадёт только то, что ты подтвердил.</p>
        <div className="source-pill">{sourceName}</div>
        <textarea className="import-textarea" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={"починить пиксельный дайв\nэффект для стены\nиконка чипа\nкараоке свет\n..."} />
        <div className="actions"><button className="primary" disabled={!raw.trim() || analyzing} onClick={() => void analyze()}>{analyzing ? "Разбираю…" : "Analyze backlog"}</button>{raw && <button onClick={() => { setRaw(""); setSuggestions([]); setSummary(""); }}>Clear</button>}</div>
      </section>

      {(summary || suggestions.length > 0) && <section className="panel">
        <div className="panel-head"><div><small>{aiUsed ? "AI ANALYSIS" : "LOCAL ANALYSIS"}</small><h3>{summary || `${suggestions.length} tasks`}</h3></div>{suggestions.length > 0 && <button className="primary" disabled={selected.size === 0} onClick={importSelected}>Import selected ({selected.size})</button>}</div>
        {suggestions.length > 0 && <div className="import-list">{suggestions.map((item) => <button key={item.tempId} className={selected.has(item.tempId) ? "import-row selected" : "import-row"} onClick={() => toggle(item.tempId)}><span className={selected.has(item.tempId) ? "check checked" : "check"}>{selected.has(item.tempId) ? "✓" : ""}</span><div><strong>{item.title}</strong><div className="task-meta">{item.project && <span>{item.project}</span>}{item.area && <span>{item.area}</span>}{item.taskType && <span>{item.taskType}</span>}{item.estimateMinutes && <span>~{formatMinutes(item.estimateMinutes)}</span>}{item.streamFriendly && <span>stream</span>}{item.blocking && <span className="meta-hot">blocker</span>}</div>{item.reason && <p className="task-reason">{item.reason}</p>}{item.possibleDuplicateTaskId && <p className="duplicate-warning">⚠ Возможный дубль существующей задачи — по умолчанию не выбран.</p>}</div></button>)}</div>}
      </section>}
    </div>
  );
}

function RoutinesView({ state, setState }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [newText, setNewText] = useState("");
  const routine = state.routines.find((r) => r.id === "stream-prep") || state.routines[0];
  if (!routine) return null;
  function patchItems(items: typeof routine.items) { setState((s) => ({ ...s, routines: s.routines.map((r) => r.id === routine.id ? { ...r, items } : r) })); }
  return <div className="page-stack"><section className="panel routine-card"><div className="panel-head"><div><small>EDITABLE CHECKLIST</small><h2>{routine.title}</h2></div><div className="actions"><button onClick={() => void window.directorBridge.openStreamPrep()}>Test popup</button><button onClick={() => patchItems(routine.items.map((i) => ({ ...i, checked: false })))}>Reset</button></div></div>{routine.items.map((item) => <div className="routine-row" key={item.id}><button className={item.checked ? "task-check checked" : "task-check"} onClick={() => patchItems(routine.items.map((i) => i.id === item.id ? { ...i, checked: !i.checked } : i))}>{item.checked ? "✓" : ""}</button><input value={item.text} onChange={(e) => patchItems(routine.items.map((i) => i.id === item.id ? { ...i, text: e.target.value } : i))} /><button className="danger-text" onClick={() => patchItems(routine.items.filter((i) => i.id !== item.id))}>×</button></div>)}<div className="routine-add"><input value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="Новый пункт…" onKeyDown={(e) => { if (e.key === "Enter" && newText.trim()) { patchItems([...routine.items, { id: uid(), text: newText.trim(), checked: false }]); setNewText(""); } }} /><button onClick={() => { if (newText.trim()) { patchItems([...routine.items, { id: uid(), text: newText.trim(), checked: false }]); setNewText(""); } }}>Add</button></div></section></div>;
}

function ChatView({ state, setState }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  async function send() {
    const text = message.trim(); if (!text || sending) return;
    const userMessage = { id: uid(), role: "user" as const, content: text, createdAt: new Date().toISOString() };
    const nextState = { ...state, chat: [...state.chat, userMessage] };
    setState(nextState); setMessage(""); setSending(true);
    try {
      const data = await window.directorBridge.chat(nextState, text);
      setState((s) => ({ ...s, chat: [...s.chat, { id: uid(), role: "assistant", content: data.message, createdAt: new Date().toISOString() }] }));
    } catch {
      setState((s) => ({ ...s, chat: [...s.chat, { id: uid(), role: "assistant", content: "Связь с AI не удалась, но локальные данные на месте.", createdAt: new Date().toISOString() }] }));
    } finally { setSending(false); }
  }
  return <div className="chat-layout"><div className="chat-history">{state.chat.map((m) => <div key={m.id} className={m.role === "user" ? "message user" : "message assistant"}><small>{m.role === "user" ? "YOU" : "DIRECTOR"}</small><p>{m.content}</p></div>)}{sending && <div className="message assistant"><small>DIRECTOR</small><p className="thinking-dots">Думаю…</p></div>}</div><div className="chat-compose"><textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Например: работа сегодня затянулась на три часа, что теперь делать?" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} /><button className="primary" onClick={() => void send()} disabled={sending}>Send</button></div></div>;
}

function SettingsView() {
  const [apiKey, setApiKey] = useState("");
  const [settings, setSettings] = useState<DirectorSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [version, setVersion] = useState("");
  const [databasePath, setDatabasePath] = useState("");
  const [schemaVersion, setSchemaVersion] = useState<number | null>(null);
  const [migrationBackup, setMigrationBackup] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [reminderStatus, setReminderStatus] = useState<ReminderStatus | null>(null);

  useEffect(() => {
    window.directorBridge.getSettings().then(setSettings);
    window.directorBridge.getAppInfo().then((i) => {
      setVersion(i.version);
      setDatabasePath(i.databasePath);
      setSchemaVersion(i.databaseSchemaVersion);
      setMigrationBackup(i.databaseMigrationInfo?.backupPath || null);
    });
    window.directorBridge.getUpdateState().then(setUpdateState);
    window.directorBridge.onUpdateState(setUpdateState);
    window.directorBridge.getReminderStatus().then(setReminderStatus);
    const reminderTimer = window.setInterval(() => {
      window.directorBridge.getReminderStatus().then(setReminderStatus).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(reminderTimer);
  }, []);

  if (!settings) return <div className="page-stack"><section className="panel">Loading settings…</section></div>;
  const currentSettings = settings;

  async function save() {
    const result = await window.directorBridge.saveSettings({ ...currentSettings, apiKey: apiKey.trim() || undefined });
    setSettings(result);
    setSaved(true);
    setApiKey("");
    window.setTimeout(() => setSaved(false), 1800);
    window.setTimeout(() => window.directorBridge.getUpdateState().then(setUpdateState), 150);
    window.setTimeout(() => window.directorBridge.getReminderStatus().then(setReminderStatus), 180);
  }

  async function clearKey() {
    const result = await window.directorBridge.saveSettings({ clearApiKey: true });
    setSettings(result);
    setApiKey("");
  }

  async function checkUpdates() {
    setUpdateState((current) => ({
      status: "checking",
      currentVersion: current?.currentVersion || version || "…",
      availableVersion: current?.availableVersion,
      percent: current?.percent || 0,
      message: "Checking GitHub for updates…",
      lastCheckedAt: current?.lastCheckedAt,
      repository: `${currentSettings.updateRepoOwner}/${currentSettings.updateRepoName}`,
      installSupported: current?.installSupported ?? true,
    }));
    try {
      const persisted = await window.directorBridge.saveSettings({
        updateRepoOwner: currentSettings.updateRepoOwner,
        updateRepoName: currentSettings.updateRepoName,
        autoUpdateEnabled: currentSettings.autoUpdateEnabled,
        autoDownloadUpdates: currentSettings.autoDownloadUpdates,
      });
      setSettings(persisted);
      const next = await window.directorBridge.checkForUpdates();
      if (next) setUpdateState(next);
    } catch (error) {
      setUpdateState((current) => ({
        status: "error",
        currentVersion: current?.currentVersion || version || "…",
        availableVersion: current?.availableVersion,
        percent: current?.percent || 0,
        message: error instanceof Error ? error.message : String(error || "Update check failed"),
        lastCheckedAt: new Date().toISOString(),
        repository: current?.repository,
        installSupported: current?.installSupported ?? true,
      }));
    }
  }

  async function downloadUpdate() {
    const next = await window.directorBridge.downloadUpdate();
    if (next) setUpdateState(next);
  }

  async function installUpdate() {
    await window.directorBridge.installUpdate();
  }

  function toggleDay(day: number) {
    setSettings((current) => {
      if (!current) return current;
      const has = current.streamReminderDays.includes(day);
      const nextDays = has ? current.streamReminderDays.filter((d) => d !== day) : [...current.streamReminderDays, day].sort((a, b) => a - b);
      return { ...current, streamReminderDays: nextDays.length ? nextDays : current.streamReminderDays };
    });
  }

  const repoReady = Boolean(settings.updateRepoOwner && settings.updateRepoName);
  const lastChecked = updateState?.lastCheckedAt
    ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(updateState.lastCheckedAt))
    : "ещё не проверялось";
  const nextReminderLabel = reminderStatus?.nextAt
    ? new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(reminderStatus.nextAt))
    : "—";
  const reminderNowLabel = reminderStatus?.now
    ? new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(reminderStatus.now))
    : "—";

  return (
    <div className="page-stack">
      <section className="panel settings-card">
        <div className="panel-head"><div><small>DESKTOP</small><h2>Director settings</h2></div><span className="time-chip">v{version || "…"}</span></div>
        <p className="settings-copy">API-ключ шифруется через системное хранилище Electron/Windows и после сохранения обратно в интерфейс не выдаётся.</p>
        <label className="settings-field"><span>OpenAI API key</span><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={settings.hasApiKey ? "Ключ уже сохранён — вставь новый только для замены" : "sk-…"} /></label>
        <label className="settings-field"><span>Model</span><input value={settings.model} onChange={(e) => setSettings({ ...settings, model: e.target.value })} /></label>
        <div className="actions"><button className="primary" onClick={() => void save()}>{saved ? "✓ Saved" : "Save settings"}</button>{settings.hasApiKey && <button onClick={() => void clearKey()}>Remove API key</button>}<span className="settings-status">{settings.hasApiKey ? "AI подключён" : "AI пока не подключён"}</span></div>
      </section>

      <section className="panel settings-card update-card">
        <div className="panel-head"><div><small>UPDATES</small><h2>Director Auto Update</h2></div><span className={`update-badge update-${updateState?.status || "idle"}`}>{updateState?.status || "idle"}</span></div>
        <p className="settings-copy">Репозиторий обновлений уже встроен. Check now сразу сохраняет эти поля, проверяет GitHub и показывает ошибку, если GitHub недоступен. База лежит отдельно от программы, поэтому обновление её не заменяет.</p>
        <label className="toggle-row"><input type="checkbox" checked={settings.autoUpdateEnabled} onChange={(e) => setSettings({ ...settings, autoUpdateEnabled: e.target.checked })} /><span><strong>Check automatically</strong><small>Проверка при запуске и затем раз в несколько часов.</small></span></label>
        <label className="toggle-row"><input type="checkbox" checked={settings.autoDownloadUpdates} onChange={(e) => setSettings({ ...settings, autoDownloadUpdates: e.target.checked })} /><span><strong>Download automatically</strong><small>Новая версия скачивается в фоне; установка только после твоего Restart & Update.</small></span></label>
        <div className="settings-grid">
          <label className="settings-field"><span>GitHub owner</span><input value={settings.updateRepoOwner} onChange={(e) => setSettings({ ...settings, updateRepoOwner: e.target.value.trim() })} placeholder="например username" /></label>
          <label className="settings-field"><span>Release repository</span><input value={settings.updateRepoName} onChange={(e) => setSettings({ ...settings, updateRepoName: e.target.value.trim() })} placeholder="например life-director" /></label>
        </div>
        <p className="settings-hint">Для бесшовных обновлений репозиторий с Releases должен быть публичным. Исходники позже можно вынести отдельно, если не захочешь держать их публичными.</p>
        <div className="update-status-box">
          <div><strong>{updateState?.message || "Updater loading…"}</strong><small>Current: {updateState?.currentVersion || version || "…"}{updateState?.availableVersion ? `  →  ${updateState.availableVersion}` : ""}</small></div>
          <small>Last check: {lastChecked}{updateState?.repository ? ` · ${updateState.repository}` : ""}</small>
          {updateState?.status === "downloading" && <div className="progress"><span style={{ width: `${Math.round(updateState.percent || 0)}%` }} /></div>}
        </div>
        <div className="actions">
          <button className="primary" onClick={() => void save()}>{saved ? "✓ Saved" : "Save update settings"}</button>
          <button onClick={() => void checkUpdates()} disabled={!repoReady || updateState?.status === "checking" || updateState?.status === "downloading"}>Check now</button>
          {updateState?.status === "available" && <button onClick={() => void downloadUpdate()}>Download update</button>}
          {updateState?.status === "downloaded" && <button className="primary" onClick={() => void installUpdate()}>Restart & Update</button>}
        </div>
      </section>

      <section className="panel settings-card">
        <div className="panel-head"><div><small>STREAM SCHEDULER</small><h2>Stream Prep reminder</h2></div><span className="time-chip">scheduler</span></div>
        <label className="toggle-row"><input type="checkbox" checked={settings.streamReminderEnabled} onChange={(e) => setSettings({ ...settings, streamReminderEnabled: e.target.checked })} /><span><strong>Enable reminder</strong><small>Windows notification + окно поверх остальных</small></span></label>
        <label className="toggle-row"><input type="checkbox" checked={settings.popupSoundEnabled} onChange={(e) => setSettings({ ...settings, popupSoundEnabled: e.target.checked })} /><span><strong>Popup sound</strong><small>Проиграть системный звук вместе с Stream Prep.</small></span></label>
        <div className="weekday-row">{weekdayLabels.map((label, day) => <button key={label} className={settings.streamReminderDays.includes(day) ? "day active" : "day"} onClick={() => toggleDay(day)}>{label}</button>)}</div>
        <div className="settings-grid"><label className="settings-field"><span>Prep popup</span><input type="time" value={settings.streamReminderTime} onChange={(e) => setSettings({ ...settings, streamReminderTime: e.target.value })} /></label><label className="settings-field"><span>Snooze, minutes</span><input type="number" min={5} max={240} value={settings.snoozeMinutes} onChange={(e) => setSettings({ ...settings, snoozeMinutes: Number(e.target.value) || 15 })} /></label></div>
        <div className="stream-calendar-settings">
          <label className="toggle-row"><input type="checkbox" checked={settings.streamCalendarEnabled} onChange={(e) => setSettings({ ...settings, streamCalendarEnabled: e.target.checked })} /><span><strong>Add streams to Calendar automatically</strong><small>Для выбранных дней Director создаёт повторяющиеся Stream-блоки на ближайшие 120 дней.</small></span></label>
          <div className="settings-grid"><label className="settings-field"><span>Stream starts</span><input type="time" value={settings.streamStartTime} onChange={(e) => setSettings({ ...settings, streamStartTime: e.target.value })} /></label><label className="settings-field"><span>Stream ends</span><input type="time" value={settings.streamEndTime} onChange={(e) => setSettings({ ...settings, streamEndTime: e.target.value })} /></label></div>
          {settings.streamEndTime <= settings.streamStartTime && <p className="duplicate-warning">Конец стрима должен быть позже начала.</p>}
        </div>
        <label className="toggle-row"><input type="checkbox" checked={settings.startWithWindows} onChange={(e) => setSettings({ ...settings, startWithWindows: e.target.checked })} /><span><strong>Start with Windows</strong><small>Нужно, чтобы напоминание сработало, даже если ты не открывал главное окно.</small></span></label>
        <label className="toggle-row"><input type="checkbox" checked={settings.closeToTray} onChange={(e) => setSettings({ ...settings, closeToTray: e.target.checked })} /><span><strong>Close to tray</strong><small>Крестик скрывает окно, но Director остаётся жить возле часов.</small></span></label>
        <div className="reminder-status-box">
          <div><strong>Next reminder: {nextReminderLabel}</strong><small>Director clock: {reminderNowLabel} · today: {reminderStatus?.todayLog?.status || "not triggered"}</small></div>
          <small className="mono-path">Log: {reminderStatus?.debugLogPath || "…"}</small>
        </div>
        <div className="actions"><button className="primary" onClick={() => void save()}>{saved ? "✓ Saved" : "Save scheduler"}</button><button onClick={() => void window.directorBridge.openStreamPrep()}>Test popup + sound</button></div>
      </section>

      <section className="panel settings-card">
        <small>DATABASE</small>
        <h3>SQLite local database <span className="schema-chip">schema {schemaVersion ?? "…"}</span></h3>
        <p className="settings-copy">Задачи, чеклисты и чат лежат в отдельном <b>director.db</b>. Новые версии Director автоматически прогоняют миграции схемы; перед изменением существующей базы создаётся резервная копия.</p>
        <div className="path-box">{databasePath || "…"}</div>
        {migrationBackup && <div className="migration-note">Последняя миграция сохранила backup: <span>{migrationBackup}</span></div>}
        <div className="actions"><button onClick={() => void window.directorBridge.openDataFolder()}>Open data folder</button></div>
      </section>
    </div>
  );
}

function StreamPrepPopup() {
  const [state, setState] = useState<AppState | null>(null);
  const [settings, setSettings] = useState<DirectorSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([loadState(), window.directorBridge.getSettings()]).then(([nextState, nextSettings]) => {
      setState(nextState);
      setSettings(nextSettings);
      if (nextSettings.popupSoundEnabled) {
        const audioUrl = new URL("./stream-alert.wav", window.location.href).toString();
        const audio = new Audio(audioUrl);
        audio.volume = 0.9;
        void audio.play().catch((error) => console.warn("Stream alert sound failed", error));
      }
    });
  }, []);

  if (!state || !settings) return <div className="popup-shell"><div className="popup-card">Loading Stream Prep…</div></div>;
  const currentState = state;
  const routine = currentState.routines.find((r) => r.id === "stream-prep") || currentState.routines[0];
  if (!routine) return <div className="popup-shell"><div className="popup-card"><h2>Stream Prep</h2><p>Чеклист не найден.</p></div></div>;
  const done = routine.items.filter((i) => i.checked).length;
  const allDone = routine.items.length > 0 && done === routine.items.length;

  async function patchItems(items: typeof routine.items) {
    const next: AppState = { ...currentState, routines: currentState.routines.map((r) => r.id === routine.id ? { ...r, items } : r) };
    setState(next);
    setSaving(true);
    try { await saveState(next); } finally { setSaving(false); }
  }

  return (
    <div className="popup-shell">
      <section className="popup-card">
        <div className="popup-head"><div><small>📺 STREAM PREP</small><h1>Перед стримом</h1></div><button className="icon-button" title="Закрыть = отложить" onClick={() => void window.directorBridge.streamAction("dismiss")}>×</button></div>
        <p className="popup-copy">{new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date())}</p>
        <div className="progress"><span style={{ width: `${routine.items.length ? (done / routine.items.length) * 100 : 0}%` }} /></div>
        <div className="popup-count">{done} / {routine.items.length}</div>
        <div className="popup-checklist">{routine.items.map((item) => <button key={item.id} className={item.checked ? "popup-check checked" : "popup-check"} onClick={() => void patchItems(routine.items.map((i) => i.id === item.id ? { ...i, checked: !i.checked } : i))}><span className="check">{item.checked ? "✓" : ""}</span><span>{item.text}</span></button>)}</div>
        <div className="popup-actions"><button onClick={() => void window.directorBridge.streamAction("snooze")}>Отложить {settings.snoozeMinutes} мин</button><button className="primary" disabled={!allDone || saving} onClick={() => void window.directorBridge.streamAction("complete")}>{saving ? "Saving…" : "✓ Готово"}</button></div>
        <button className="text-button popup-skip" onClick={() => void window.directorBridge.streamAction("skip")}>Пропустить сегодня</button>
      </section>
    </div>
  );
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
