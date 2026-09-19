import { AppState, DirectorPick, Task } from "./types";

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function minutesOfDay(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function availableMinutesUntilNextBlock(state: AppState) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const blocks = state.calendarBlocks
    .filter((b) => b.date === localDateKey(now))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (const block of blocks) {
    const start = minutesOfDay(block.startTime);
    const end = minutesOfDay(block.endTime);
    // Being inside a calendar block should not make the planner unusable. We only
    // constrain the pick when there is a future block we need to fit before.
    if (nowMinutes >= start && nowMinutes < end) continue;
    if (start > nowMinutes) return Math.max(0, start - nowMinutes);
  }
  return Math.max(0, 24 * 60 - nowMinutes);
}

function isDeferredForFuture(task: Task) {
  return task.status === "deferred" && task.deferredUntil && new Date(task.deferredUntil).getTime() > Date.now();
}

function inferredStreamAffinity(task: Task) {
  const text = [task.title, task.taskType, task.area, task.feature, ...(task.tags || [])].filter(Boolean).join(" ").toLowerCase();
  if (/bug|баг|почин|fix|logic|логик|save|сохран|optimization|оптимизац|system|систем|manager|component|reload|скорост/.test(text)) return -1;
  if (/vfx|ниагар|effect|эффект|ui|widget|виджет|animation|анимац|model|модел|asset|ассет|poster|плакат|свет|visual|визуал|art|арт|икон|дизайн|design|материал/.test(text)) return 1;
  return 0;
}

function candidateTasks(state: AppState, excludeTaskIds: string[] = []) {
  const excluded = new Set(excludeTaskIds);
  return state.tasks.filter((task) =>
    !["done", "archived", "inbox"].includes(task.status) &&
    !isDeferredForFuture(task) &&
    !excluded.has(task.id)
  );
}

function poolForMode(tasks: Task[], mode: "work" | "stream" | "short" | "visual") {
  if (!tasks.length) return tasks;

  if (mode === "stream") {
    const explicit = tasks.filter((task) => task.streamFriendly === true);
    if (explicit.length) return explicit;
    const inferred = tasks.filter((task) => inferredStreamAffinity(task) > 0);
    return inferred.length ? inferred : tasks;
  }

  if (mode === "visual") {
    const explicit = tasks.filter((task) => task.visual === true);
    if (explicit.length) return explicit;
    const inferred = tasks.filter((task) => inferredStreamAffinity(task) > 0);
    return inferred.length ? inferred : tasks;
  }

  if (mode === "short") {
    const short = tasks.filter((task) => (task.estimateMinutes ?? 60) <= 45);
    if (short.length) return short;
    const nearShort = tasks.filter((task) => (task.estimateMinutes ?? 60) <= 60);
    return nearShort.length ? nearShort : tasks;
  }

  // Focus is still random, it only narrows the pool toward work that is better
  // done off-stream / in concentration mode. There is no score ordering anymore.
  const focus = tasks.filter((task) =>
    task.streamFriendly === false ||
    task.deepWork === true ||
    task.taskType === "bug" ||
    inferredStreamAffinity(task) < 0
  );
  return focus.length ? focus : tasks;
}

function randomIndex(length: number) {
  if (length <= 1) return 0;
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const value = new Uint32Array(1);
    cryptoApi.getRandomValues(value);
    return value[0] % length;
  }
  return Math.floor(Math.random() * length);
}

export function rankedDirectorTasks(
  state: AppState,
  mode: "work" | "stream" | "short" | "visual" = "work",
  excludeTaskIds: string[] = [],
) {
  // Kept for compatibility with older code/debug tooling. The returned order is
  // deliberately shuffled instead of ranked by a deterministic score.
  const pool = poolForMode(candidateTasks(state, excludeTaskIds), mode);
  return pool
    .map((task) => ({ task, score: 0, index: Math.random() }))
    .sort((a, b) => a.index - b.index);
}

export function localDirectorPick(
  state: AppState,
  mode: "work" | "stream" | "short" | "visual" = "work",
  excludeTaskIds: string[] = [],
): DirectorPick | null {
  const all = candidateTasks(state, []);
  if (!all.length) return null;

  let pool = poolForMode(candidateTasks(state, excludeTaskIds), mode);

  // When the recent-history exclusion has exhausted a small mode pool, start a
  // fresh random cycle but still avoid immediately returning the current task.
  if (!pool.length && excludeTaskIds.length) {
    const currentId = excludeTaskIds[0];
    const withoutCurrent = all.filter((task) => task.id !== currentId);
    pool = poolForMode(withoutCurrent.length ? withoutCurrent : all, mode);
  }
  if (!pool.length) return null;

  const task = pool[randomIndex(pool.length)];
  const reasons: string[] = [`случайный выбор из ${pool.length} подходящих задач режима`];
  if (mode === "stream") reasons.push("пул ограничен задачами, подходящими для стрима");
  if (mode === "visual") reasons.push("пул ограничен визуальными задачами");
  if (mode === "short") reasons.push("пул ограничен короткими задачами, когда это возможно");
  if (mode === "work") reasons.push("пул смещён к Focus/off-stream работе, но внутри него нет рейтинга");

  const available = availableMinutesUntilNextBlock(state);
  if (available > 0 && task.estimateMinutes && task.estimateMinutes <= available) {
    reasons.push(`она помещается в свободное окно примерно на ${available} мин`);
  }

  return {
    taskId: task.id,
    taskTitle: task.title,
    why: reasons.join("; ") + ".",
    estimatedMinutes: task.estimateMinutes,
  };
}
