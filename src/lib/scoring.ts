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

function scoreTask(task: Task, state: AppState, mode: "work" | "stream" | "short" | "visual" = "work") {
  let score = 0;
  if (task.status === "active") score += 28;
  if (task.blocking) score += 24;
  if (task.taskType === "bug") score += 10;
  if (task.kind === "dev") score += 7;
  if (task.project === "Reytrieve Odyssey") score += 5;
  if (task.deepWork) score += state.energy === "full" ? 14 : state.energy === "normal" ? 6 : -18;
  if (!task.deepWork && (state.energy === "low" || state.energy === "dead")) score += 12;

  if (mode === "stream") {
    if (task.streamFriendly === true) score += 48;
    else if (task.streamFriendly === false) score -= 48;
    else {
      const affinity = inferredStreamAffinity(task);
      score += affinity > 0 ? 20 : affinity < 0 ? -20 : -6;
    }
    if (task.visual || (task.visual === undefined && inferredStreamAffinity(task) > 0)) score += 10;
    if (task.deepWork) score -= 12;
  }
  if (mode === "work") {
    // Preserve obvious showy tasks for streams when a useful off-stream job exists.
    if (task.streamFriendly === false) score += 10;
    if (task.streamFriendly === true && task.visual) score -= 3;
  }
  if (mode === "visual") {
    if (task.visual === true) score += 32;
    else if (task.visual === false) score -= 12;
    else score += inferredStreamAffinity(task) > 0 ? 20 : -8;
  }
  if (mode === "short") score += (task.estimateMinutes ?? 60) <= 45 ? 32 : -22;
  if ((task.estimateMinutes ?? 60) <= 120) score += 4;

  const available = availableMinutesUntilNextBlock(state);
  if (available > 0 && (task.estimateMinutes ?? 60) > available + 10) score -= 26;
  if (available > 0 && (task.estimateMinutes ?? 60) <= available) score += 6;
  if (task.status === "deferred") score -= 6;
  return score;
}

export function rankedDirectorTasks(
  state: AppState,
  mode: "work" | "stream" | "short" | "visual" = "work",
  excludeTaskIds: string[] = [],
) {
  const excluded = new Set(excludeTaskIds);
  return state.tasks
    .filter((t) => !["done", "archived", "inbox"].includes(t.status) && !isDeferredForFuture(t) && !excluded.has(t.id))
    .map((task, index) => ({ task, score: scoreTask(task, state, mode), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

export function localDirectorPick(
  state: AppState,
  mode: "work" | "stream" | "short" | "visual" = "work",
  excludeTaskIds: string[] = [],
): DirectorPick | null {
  let ranked = rankedDirectorTasks(state, mode, excludeTaskIds);
  // If the user has rerolled through the whole pool, reset exclusions rather than
  // returning an empty planner.
  if (!ranked.length && excludeTaskIds.length) ranked = rankedDirectorTasks(state, mode, []);
  if (!ranked.length) return null;

  const task = ranked[0].task;
  const reasons: string[] = [];
  if (task.status === "active") reasons.push("ты уже начал её — меньше потерь на переключение контекста");
  if (task.blocking) reasons.push("она блокирует дальнейшую работу, поэтому её выгоднее закрыть раньше");
  if (task.project === "Reytrieve Odyssey") reasons.push("она двигает основной проект");
  if (mode === "stream" && task.streamFriendly) reasons.push("она хорошо подходит для стрима");
  if (mode === "work" && task.streamFriendly === false) reasons.push("её логичнее закрыть вне стрима");
  if (mode === "visual" && task.visual) reasons.push("у неё быстрый визуальный результат");
  if ((state.energy === "low" || state.energy === "dead") && !task.deepWork) reasons.push("она не требует тяжёлой концентрации сегодня");
  const available = availableMinutesUntilNextBlock(state);
  if (available > 0 && task.estimateMinutes && task.estimateMinutes <= available) reasons.push(`она помещается в свободное окно примерно на ${available} мин`);
  if (!reasons.length) reasons.push("это наиболее подходящая задача из текущей очереди по времени и контексту");
  return {
    taskId: task.id,
    taskTitle: task.title,
    why: reasons.join("; ") + ".",
    estimatedMinutes: task.estimateMinutes,
  };
}
