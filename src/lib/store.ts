import { AppState } from "./types";

export const STORAGE_KEY = "director-state-v1";

export const initialState: AppState = {
  energy: "normal",
  tasks: [
    {
      id: "seed-pixel",
      title: "Закончить механику Pixel Dive",
      notes: "Проверить входную траекторию, выход и отмену при конце стены.",
      status: "todo",
      kind: "dev",
      taskType: "feature",
      project: "Reytrieve Odyssey",
      area: "Pixel Chip",
      feature: "Pixel Dive",
      estimateMinutes: 120,
      streamFriendly: false,
      visual: false,
      deepWork: true,
      blocking: true,
      source: "seed",
      createdAt: new Date().toISOString(),
    },
    {
      id: "seed-karaoke",
      title: "Собрать визуальный проход сцены караоке",
      status: "todo",
      kind: "stream",
      taskType: "art",
      project: "Reytrieve Odyssey",
      area: "Karaoke Act",
      chapter: "Chapter 2",
      estimateMinutes: 90,
      streamFriendly: true,
      visual: true,
      deepWork: false,
      source: "seed",
      createdAt: new Date().toISOString(),
    },
  ],
  routines: [
    {
      id: "stream-prep",
      title: "Stream Prep",
      items: [
        { id: "obs", text: "OBS и правильная сцена", checked: false },
        { id: "task", text: "Подготовить понятную задачу для стрима", checked: false },
        { id: "unreal", text: "Открыть Unreal и нужную карту", checked: false },
        { id: "mic", text: "Проверить микрофон и звук", checked: false },
        { id: "notifications", text: "Выключить лишние уведомления", checked: false },
        { id: "water", text: "Вода рядом", checked: false },
      ],
    },
  ],
  calendarBlocks: [],
  chat: [
    {
      id: "hello",
      role: "assistant",
      content: "Я Director. Кидай сюда задачи, изменения планов или просто скажи, в каком ты сегодня состоянии — разберём, что имеет смысл делать.",
      createdAt: new Date().toISOString(),
    },
  ],
};

function mergeState(raw: AppState): AppState {
  return {
    energy: raw.energy || "normal",
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    routines: Array.isArray(raw.routines) && raw.routines.length ? raw.routines : initialState.routines,
    chat: Array.isArray(raw.chat) && raw.chat.length ? raw.chat : initialState.chat,
    calendarBlocks: Array.isArray(raw.calendarBlocks) ? raw.calendarBlocks : [],
  };
}

export async function loadState(): Promise<AppState> {
  const dbState = await window.directorBridge.loadState();
  if (dbState) return mergeState(dbState);

  try {
    const legacyRaw = localStorage.getItem(STORAGE_KEY);
    if (legacyRaw) {
      const legacy = mergeState(JSON.parse(legacyRaw) as AppState);
      await window.directorBridge.migrateLegacyState(legacy);
      localStorage.removeItem(STORAGE_KEY);
      return legacy;
    }
  } catch {
    // Ignore damaged legacy storage and start clean.
  }

  await window.directorBridge.saveState(initialState);
  return initialState;
}

export async function saveState(state: AppState) {
  await window.directorBridge.saveState(state);
}
