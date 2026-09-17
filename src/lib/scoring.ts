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
    if (nowMinutes >= start && nowMinutes < end) return 0;
    if (start > nowMinutes) return Math.max(0, start - nowMinutes);
  }
  return Math.max(0, 24 * 60 - nowMinutes);
}

function isDeferredForFuture(task: Task) {
  return task.status === "deferred" && task.deferredUntil && new Date(task.deferredUntil).getTime() > Date.now();
}

function scoreTask(task: Task, state: AppState, mode: "work" | "stream" | "short" | "visual" = "work") {
  let score = 0;
  if (task.status === "active") score += 28;
  if (task.blocking) score += 24;
  if (task.taskType === "bug") score += 8;
  if (task.kind === "dev") score += 7;
  if (task.project === "Reytrieve Odyssey") score += 5;
  if (task.deepWork) score += state.energy === "full" ? 14 : state.energy === "normal" ? 6 : -18;
  if (!task.deepWork && (state.energy === "low" || state.energy === "dead")) score += 12;
  if (mode === "stream") score += task.streamFriendly ? 38 : -28;
  if (mode === "visual") score += task.visual ? 32 : -12;
  if (mode === "short") score += (task.estimateMinutes ?? 60) <= 45 ? 32 : -22;
  if ((task.estimateMinutes ?? 60) <= 120) score += 4;
  const available = availableMinutesUntilNextBlock(state);
  if (available > 0 && (task.estimateMinutes ?? 60) > available + 10) score -= 26;
  if (available > 0 && (task.estimateMinutes ?? 60) <= available) score += 6;
  if (task.status === "deferred") score -= 6;
  return score;
}

export function localDirectorPick(state: AppState, mode: "work" | "stream" | "short" | "visual" = "work"): DirectorPick | null {
  const candidates = state.tasks.filter((t) => !["done", "archived", "inbox"].includes(t.status) && !isDeferredForFuture(t));
  if (!candidates.length) return null;
  const task = [...candidates].sort((a, b) => scoreTask(b, state, mode) - scoreTask(a, state, mode))[0];
  const reasons: string[] = [];
  if (task.status === "active") reasons.push("ты уже начал её — меньше потерь на переключение контекста");
  if (task.blocking) reasons.push("она блокирует дальнейшую работу, поэтому её выгоднее закрыть раньше");
  if (task.project === "Reytrieve Odyssey") reasons.push("она двигает основной проект");
  if (mode === "stream" && task.streamFriendly) reasons.push("она хорошо подходит для стрима");
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
