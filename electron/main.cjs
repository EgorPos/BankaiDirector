const { app, BrowserWindow, ipcMain, shell, Tray, Menu, Notification, dialog, safeStorage, powerMonitor } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { DIRECTOR_PROMPT, REYTRIEVE_CONTEXT } = require("./context.cjs");
const { CURRENT_SCHEMA_VERSION, runDatabaseMigrations } = require("./migrations.cjs");
const { createUpdateManager } = require("./updater.cjs");

let mainWindow;
let streamPrepWindow;
let tray;
let db;
let schedulerTimer;
let isQuitting = false;
let updateManager;
let databaseMigrationInfo = { fromVersion: 0, toVersion: 0, backupPath: null, migrated: false };

const DEFAULT_SETTINGS = {
  model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
  streamReminderEnabled: true,
  streamReminderDays: [1, 4, 6], // Monday, Thursday, Saturday
  streamReminderTime: "18:00",
  snoozeMinutes: 15,
  startWithWindows: true,
  closeToTray: true,
  streamCalendarEnabled: true,
  streamStartTime: "20:00",
  streamEndTime: "23:00",
  popupSoundEnabled: true,
  autoUpdateEnabled: true,
  autoDownloadUpdates: true,
  updateRepoOwner: "EgorPos",
  updateRepoName: "BankaiDirector",
};

function settingsPath() {
  return path.join(app.getPath("userData"), "director-settings.json");
}

function databasePath() {
  return path.join(app.getPath("userData"), "director.db");
}

function readSettingsRaw() {
  try {
    if (!fs.existsSync(settingsPath())) return {};
    return JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
  } catch {
    return {};
  }
}

function writeSettingsRaw(raw) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(raw, null, 2), "utf8");
}

function migratePlaintextApiKey(raw) {
  if (!raw.apiKey || raw.encryptedApiKey || !safeStorage.isEncryptionAvailable()) return raw;
  try {
    const next = { ...raw, encryptedApiKey: safeStorage.encryptString(String(raw.apiKey)).toString("base64") };
    delete next.apiKey;
    writeSettingsRaw(next);
    return next;
  } catch {
    return raw;
  }
}

function getApiKey(rawInput) {
  const raw = rawInput || migratePlaintextApiKey(readSettingsRaw());
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  if (raw.encryptedApiKey && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(raw.encryptedApiKey, "base64"));
    } catch {
      return "";
    }
  }
  return typeof raw.apiKey === "string" ? raw.apiKey : "";
}

function normalizeDays(value) {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS.streamReminderDays;
  const days = [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))];
  return days.length ? days.sort((a, b) => a - b) : DEFAULT_SETTINGS.streamReminderDays;
}

function normalizeTime(value) {
  const text = String(value || "");
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : DEFAULT_SETTINGS.streamReminderTime;
}

function normalizeRepoPart(value) {
  const text = String(value || "").trim();
  return /^[A-Za-z0-9_.-]+$/.test(text) ? text : "";
}

function readSettings() {
  const raw = migratePlaintextApiKey(readSettingsRaw());
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    model: typeof raw.model === "string" && raw.model.trim() ? raw.model.trim() : DEFAULT_SETTINGS.model,
    streamReminderDays: normalizeDays(raw.streamReminderDays),
    streamReminderTime: normalizeTime(raw.streamReminderTime),
    snoozeMinutes: Number.isFinite(Number(raw.snoozeMinutes)) ? Math.min(240, Math.max(5, Number(raw.snoozeMinutes))) : DEFAULT_SETTINGS.snoozeMinutes,
    streamReminderEnabled: raw.streamReminderEnabled !== false,
    startWithWindows: raw.startWithWindows !== false,
    closeToTray: raw.closeToTray !== false,
    streamCalendarEnabled: raw.streamCalendarEnabled !== false,
    streamStartTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(raw.streamStartTime || "")) ? String(raw.streamStartTime) : DEFAULT_SETTINGS.streamStartTime,
    streamEndTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(raw.streamEndTime || "")) ? String(raw.streamEndTime) : DEFAULT_SETTINGS.streamEndTime,
    popupSoundEnabled: raw.popupSoundEnabled !== false,
    autoUpdateEnabled: raw.autoUpdateEnabled !== false,
    autoDownloadUpdates: raw.autoDownloadUpdates !== false,
    updateRepoOwner: normalizeRepoPart(raw.updateRepoOwner) || DEFAULT_SETTINGS.updateRepoOwner,
    updateRepoName: normalizeRepoPart(raw.updateRepoName) || DEFAULT_SETTINGS.updateRepoName,
  };
}

function publicSettings() {
  const raw = readSettings();
  return {
    hasApiKey: Boolean(getApiKey(readSettingsRaw())),
    model: raw.model,
    streamReminderEnabled: raw.streamReminderEnabled,
    streamReminderDays: raw.streamReminderDays,
    streamReminderTime: raw.streamReminderTime,
    snoozeMinutes: raw.snoozeMinutes,
    startWithWindows: raw.startWithWindows,
    closeToTray: raw.closeToTray,
    streamCalendarEnabled: raw.streamCalendarEnabled,
    streamStartTime: raw.streamStartTime,
    streamEndTime: raw.streamEndTime,
    popupSoundEnabled: raw.popupSoundEnabled,
    autoUpdateEnabled: raw.autoUpdateEnabled,
    autoDownloadUpdates: raw.autoDownloadUpdates,
    updateRepoOwner: raw.updateRepoOwner,
    updateRepoName: raw.updateRepoName,
  };
}

function applyLoginItemSetting(enabled) {
  if (!app.isPackaged) return;
  try {
    app.setLoginItemSettings({ openAtLogin: Boolean(enabled), path: process.execPath });
  } catch (error) {
    console.warn("Could not update login item:", error);
  }
}

function writeSettings(next) {
  const currentRaw = migratePlaintextApiKey(readSettingsRaw());
  const current = readSettings();
  const merged = {
    ...currentRaw,
    model: typeof next.model === "string" && next.model.trim() ? next.model.trim() : current.model,
    streamReminderEnabled: typeof next.streamReminderEnabled === "boolean" ? next.streamReminderEnabled : current.streamReminderEnabled,
    streamReminderDays: next.streamReminderDays ? normalizeDays(next.streamReminderDays) : current.streamReminderDays,
    streamReminderTime: next.streamReminderTime ? normalizeTime(next.streamReminderTime) : current.streamReminderTime,
    snoozeMinutes: next.snoozeMinutes !== undefined ? Math.min(240, Math.max(5, Number(next.snoozeMinutes) || current.snoozeMinutes)) : current.snoozeMinutes,
    startWithWindows: typeof next.startWithWindows === "boolean" ? next.startWithWindows : current.startWithWindows,
    closeToTray: typeof next.closeToTray === "boolean" ? next.closeToTray : current.closeToTray,
    streamCalendarEnabled: typeof next.streamCalendarEnabled === "boolean" ? next.streamCalendarEnabled : current.streamCalendarEnabled,
    streamStartTime: next.streamStartTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(next.streamStartTime)) ? String(next.streamStartTime) : current.streamStartTime,
    streamEndTime: next.streamEndTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(next.streamEndTime)) ? String(next.streamEndTime) : current.streamEndTime,
    popupSoundEnabled: typeof next.popupSoundEnabled === "boolean" ? next.popupSoundEnabled : current.popupSoundEnabled,
    autoUpdateEnabled: typeof next.autoUpdateEnabled === "boolean" ? next.autoUpdateEnabled : current.autoUpdateEnabled,
    autoDownloadUpdates: typeof next.autoDownloadUpdates === "boolean" ? next.autoDownloadUpdates : current.autoDownloadUpdates,
    updateRepoOwner: next.updateRepoOwner !== undefined ? normalizeRepoPart(next.updateRepoOwner) : current.updateRepoOwner,
    updateRepoName: next.updateRepoName !== undefined ? normalizeRepoPart(next.updateRepoName) : current.updateRepoName,
  };

  if (next.clearApiKey) {
    delete merged.encryptedApiKey;
    delete merged.apiKey;
  } else if (typeof next.apiKey === "string" && next.apiKey.trim()) {
    const clean = next.apiKey.trim();
    if (safeStorage.isEncryptionAvailable()) {
      merged.encryptedApiKey = safeStorage.encryptString(clean).toString("base64");
      delete merged.apiKey;
    } else {
      merged.apiKey = clean;
      delete merged.encryptedApiKey;
    }
  }

  writeSettingsRaw(merged);
  applyLoginItemSetting(merged.startWithWindows);
  return publicSettings();
}

function initDatabase() {
  fs.mkdirSync(path.dirname(databasePath()), { recursive: true });
  db = new DatabaseSync(databasePath());
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  databaseMigrationInfo = runDatabaseMigrations(db, databasePath());
}

function parseJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function hasAnyState() {
  const row = db.prepare(`SELECT
    (SELECT COUNT(*) FROM tasks) +
    (SELECT COUNT(*) FROM routines) +
    (SELECT COUNT(*) FROM chat_messages) +
    (SELECT COUNT(*) FROM calendar_blocks) AS count`).get();
  const energy = db.prepare("SELECT value FROM app_meta WHERE key = 'energy'").get();
  return Number(row?.count || 0) > 0 || Boolean(energy);
}

function loadAppState() {
  if (!hasAnyState()) return null;
  const tasks = db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all().map((r) => ({
    id: r.id,
    title: r.title,
    notes: r.notes || undefined,
    checklist: parseJson(r.checklist_json, undefined),
    status: r.status,
    kind: r.kind,
    taskType: r.task_type || undefined,
    project: r.project || undefined,
    area: r.area || undefined,
    chapter: r.chapter || undefined,
    feature: r.feature || undefined,
    tags: parseJson(r.tags_json, undefined),
    estimateMinutes: r.estimate_minutes ?? undefined,
    streamFriendly: r.stream_friendly === null ? undefined : Boolean(r.stream_friendly),
    visual: r.visual === null ? undefined : Boolean(r.visual),
    deepWork: r.deep_work === null ? undefined : Boolean(r.deep_work),
    blocking: r.blocking === null ? undefined : Boolean(r.blocking),
    createdAt: r.created_at,
    completedAt: r.completed_at || undefined,
    archivedAt: r.archived_at || undefined,
    deferredUntil: r.deferred_until || undefined,
    deferReason: r.defer_reason || undefined,
    aiReason: r.ai_reason || undefined,
    classificationReason: r.classification_reason || undefined,
    classificationConfidence: r.classification_confidence ?? undefined,
    source: r.source || undefined,
  }));

  const routines = db.prepare("SELECT * FROM routines ORDER BY position ASC").all().map((r) => ({
    id: r.id,
    title: r.title,
    items: db.prepare("SELECT * FROM routine_items WHERE routine_id = ? ORDER BY position ASC").all(r.id).map((i) => ({
      id: i.id,
      text: i.text,
      checked: Boolean(i.checked),
    })),
  }));

  const chat = db.prepare("SELECT * FROM chat_messages ORDER BY created_at ASC").all().map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    createdAt: r.created_at,
  }));

  const calendarBlocks = db.prepare("SELECT * FROM calendar_blocks ORDER BY date ASC, start_time ASC").all().map((r) => ({
    id: r.id,
    title: r.title,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    kind: r.kind,
    notes: r.notes || undefined,
    createdAt: r.created_at,
  }));

  const energyRow = db.prepare("SELECT value FROM app_meta WHERE key = 'energy'").get();
  return { tasks, routines, chat, calendarBlocks, energy: energyRow?.value || "normal" };
}

function nullableBool(value) {
  return value === undefined || value === null ? null : (value ? 1 : 0);
}

function saveAppState(state) {
  if (!state || !Array.isArray(state.tasks) || !Array.isArray(state.routines) || !Array.isArray(state.chat)) {
    throw new Error("Invalid app state");
  }
  if (!Array.isArray(state.calendarBlocks)) state.calendarBlocks = [];

  db.exec("BEGIN IMMEDIATE;");
  try {
    db.exec("DELETE FROM tasks; DELETE FROM routine_items; DELETE FROM routines; DELETE FROM chat_messages; DELETE FROM calendar_blocks;");
    const insertTask = db.prepare(`INSERT INTO tasks (
      id,title,notes,checklist_json,status,kind,task_type,project,area,chapter,feature,tags_json,estimate_minutes,
      stream_friendly,visual,deep_work,blocking,created_at,completed_at,archived_at,deferred_until,defer_reason,
      ai_reason,classification_reason,classification_confidence,source
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const t of state.tasks) {
      insertTask.run(
        t.id, t.title, t.notes || null, t.checklist ? JSON.stringify(t.checklist) : null, t.status, t.kind, t.taskType || null, t.project || null, t.area || null,
        t.chapter || null, t.feature || null, t.tags ? JSON.stringify(t.tags) : null, t.estimateMinutes ?? null,
        nullableBool(t.streamFriendly), nullableBool(t.visual), nullableBool(t.deepWork), nullableBool(t.blocking),
        t.createdAt, t.completedAt || null, t.archivedAt || null, t.deferredUntil || null, t.deferReason || null, t.aiReason || null,
        t.classificationReason || null, t.classificationConfidence ?? null, t.source || null
      );
    }

    const insertRoutine = db.prepare("INSERT INTO routines (id,title,position) VALUES (?,?,?)");
    const insertRoutineItem = db.prepare("INSERT INTO routine_items (id,routine_id,text,checked,position) VALUES (?,?,?,?,?)");
    state.routines.forEach((r, ri) => {
      insertRoutine.run(r.id, r.title, ri);
      r.items.forEach((i, ii) => insertRoutineItem.run(i.id, r.id, i.text, i.checked ? 1 : 0, ii));
    });

    const insertChat = db.prepare("INSERT INTO chat_messages (id,role,content,created_at) VALUES (?,?,?,?)");
    state.chat.forEach((m) => insertChat.run(m.id, m.role, m.content, m.createdAt));

    const insertCalendar = db.prepare("INSERT INTO calendar_blocks (id,title,date,start_time,end_time,kind,notes,created_at) VALUES (?,?,?,?,?,?,?,?)");
    state.calendarBlocks.forEach((b) => insertCalendar.run(
      b.id, b.title, b.date, b.startTime, b.endTime, b.kind || "other", b.notes || null, b.createdAt || new Date().toISOString()
    ));

    db.prepare("INSERT INTO app_meta (key,value) VALUES ('energy',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(state.energy || "normal");
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

function broadcastDataChanged(exceptWebContentsId) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && win.webContents.id !== exceptWebContentsId) {
      win.webContents.send("director:data-changed");
    }
  }
}

async function getOpenAIClient() {
  const settings = readSettings();
  const apiKey = getApiKey(readSettingsRaw());
  if (!apiKey) return { client: null, settings };
  const { default: OpenAI } = await import("openai");
  return { client: new OpenAI({ apiKey }), settings };
}

function parseJsonObject(text) {
  const source = String(text || "").trim();
  const first = source.indexOf("{");
  const last = source.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  try { return JSON.parse(source.slice(first, last + 1)); } catch { return null; }
}

function fallbackClassification(title) {
  const lower = title.toLowerCase();
  const isStream = lower.includes("стрим") || lower.includes("thumbnail") || lower.includes("обложк");
  const personal = lower.includes("купить") || lower.includes("позвон") || lower.includes("записаться");
  const work = lower.includes("работ") || lower.includes("заказ") || lower.includes("клиент");
  const bug = lower.includes("баг") || lower.includes("почин") || lower.includes("fix") || lower.includes("слом");
  const visual = /vfx|ниагар|материал|ui|анимац|икон|визуал|арт|свет|shader|шейдер/.test(lower);
  return {
    kind: personal ? "personal" : work ? "work" : isStream ? "stream" : "dev",
    taskType: bug ? "bug" : visual ? "art" : personal ? "personal" : work ? "work" : "feature",
    project: personal || work ? undefined : "Reytrieve Odyssey",
    streamFriendly: isStream || visual,
    visual,
    deepWork: bug && !visual,
    blocking: bug,
    estimateMinutes: visual ? 90 : bug ? 120 : 60,
    classificationReason: "Локальная классификация без AI.",
    classificationConfidence: 0.35,
  };
}

function cleanImportLine(line) {
  return line
    .replace(/^\s*[-*•–—]+\s*/, "")
    .replace(/^\s*\d+[.)]\s*/, "")
    .replace(/^\s*\[[ xX✓]\]\s*/, "")
    .trim();
}

function fallbackImport(text, existingTasks) {
  let lines = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      lines = parsed.map((v) => typeof v === "string" ? v : (v?.title || v?.name || ""));
    } else if (Array.isArray(parsed?.tasks)) {
      lines = parsed.tasks.map((v) => typeof v === "string" ? v : (v?.title || v?.name || ""));
    }
  } catch {
    lines = text.split(/\r?\n/);
  }

  const normalizedExisting = new Map(existingTasks.map((t) => [String(t.title || "").trim().toLowerCase(), t.id]));
  const seen = new Set();
  const suggestions = [];
  for (const raw of lines) {
    const title = cleanImportLine(String(raw || ""));
    if (!title || title.length < 3 || title.length > 300) continue;
    if (/^(title|task|задача|name)[,;\t]/i.test(title)) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const c = fallbackClassification(title);
    suggestions.push({
      tempId: `import-${suggestions.length}-${Date.now()}`,
      title,
      ...c,
      reason: "Разобрано локально. С подключённым AI Director сможет точнее определить систему, главу и зависимости.",
      possibleDuplicateTaskId: normalizedExisting.get(key),
    });
    if (suggestions.length >= 250) break;
  }
  return suggestions;
}

function recordUpdateEvent(event, version, details) {
  try {
    db.prepare("INSERT INTO update_history (version,event,created_at,details) VALUES (?,?,?,?)")
      .run(String(version || app.getVersion()), String(event || "event"), new Date().toISOString(), details ? JSON.stringify(details) : null);
  } catch (error) {
    console.warn("Could not record update event:", error);
  }
}

function broadcastUpdateState(updateState) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("director:update-state", updateState);
  }
}

function appIconPath() {
  return path.join(__dirname, "../build/icon.ico");
}

function loadWindowContent(win, query) {
  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, "../dist/index.html"), query ? { query } : undefined);
  } else {
    const suffix = query ? `?${new URLSearchParams(query).toString()}` : "";
    win.loadURL(`http://127.0.0.1:5173/${suffix}`);
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1040,
    minHeight: 700,
    show: false,
    title: "Director",
    autoHideMenuBar: true,
    backgroundColor: "#0b0911",
    icon: appIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("close", (event) => {
    if (!isQuitting && readSettings().closeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  loadWindowContent(mainWindow);
  if (!app.isPackaged && process.env.DIRECTOR_DEVTOOLS === "1") mainWindow.webContents.openDevTools({ mode: "detach" });
}

function createStreamPrepWindow() {
  if (streamPrepWindow && !streamPrepWindow.isDestroyed()) {
    streamPrepWindow.show();
    streamPrepWindow.focus();
    return streamPrepWindow;
  }

  streamPrepWindow = new BrowserWindow({
    width: 540,
    height: 720,
    minWidth: 480,
    minHeight: 600,
    maxWidth: 680,
    alwaysOnTop: true,
    show: false,
    title: "Director — Stream Prep",
    autoHideMenuBar: true,
    backgroundColor: "#0b0911",
    icon: appIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  streamPrepWindow.setAlwaysOnTop(true, "floating");
  streamPrepWindow.once("ready-to-show", () => {
    streamPrepWindow.show();
    streamPrepWindow.focus();
  });
  streamPrepWindow.on("closed", () => { streamPrepWindow = null; });
  loadWindowContent(streamPrepWindow, { popup: "stream-prep" });
  return streamPrepWindow;
}

function createTray() {
  tray = new Tray(appIconPath());
  tray.setToolTip("Director");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open Director", click: showMainWindow },
    { label: "Open Stream Prep", click: () => createStreamPrepWindow() },
    { label: "Check for updates", click: () => void updateManager?.check({ manual: true }) },
    { type: "separator" },
    { label: "Quit", click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on("click", showMainWindow);
  tray.on("double-click", showMainWindow);
}

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function scheduledDateForToday(timeText, now = new Date()) {
  const [h, m] = normalizeTime(timeText).split(":").map(Number);
  const date = new Date(now);
  date.setHours(h, m, 0, 0);
  return date;
}

function getReminderLog(kind, occurrenceDate) {
  return db.prepare("SELECT * FROM reminder_log WHERE kind = ? AND occurrence_date = ?").get(kind, occurrenceDate) || null;
}

function upsertReminderLog(kind, occurrenceDate, patch) {
  const current = getReminderLog(kind, occurrenceDate) || {};
  const next = {
    status: patch.status ?? current.status ?? "shown",
    scheduled_for: patch.scheduled_for ?? current.scheduled_for ?? null,
    shown_at: patch.shown_at ?? current.shown_at ?? null,
    snoozed_until: Object.prototype.hasOwnProperty.call(patch, "snoozed_until") ? patch.snoozed_until : (current.snoozed_until ?? null),
    completed_at: patch.completed_at ?? current.completed_at ?? null,
  };
  db.prepare(`INSERT INTO reminder_log (kind,occurrence_date,status,scheduled_for,shown_at,snoozed_until,completed_at)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(kind,occurrence_date) DO UPDATE SET
      status=excluded.status, scheduled_for=excluded.scheduled_for, shown_at=excluded.shown_at,
      snoozed_until=excluded.snoozed_until, completed_at=excluded.completed_at`).run(
        kind, occurrenceDate, next.status, next.scheduled_for, next.shown_at, next.snoozed_until, next.completed_at
      );
}

function notifyStreamPrep() {
  if (Notification.isSupported()) {
    const settings = readSettings();
    const hasExplicitBeep = typeof shell.beep === "function";
    const notification = new Notification({
      title: "Director — Stream Prep",
      body: "Пора подготовиться к стриму. Чеклист уже открыт.",
      icon: appIconPath(),
      silent: settings.popupSoundEnabled ? hasExplicitBeep : true,
    });
    notification.on("click", () => createStreamPrepWindow());
    notification.show();
  }
}

function syncStreamCalendar(settingsInput) {
  if (!db) return;
  const settings = settingsInput || readSettings();
  const today = localDateKey(new Date());
  db.prepare("DELETE FROM calendar_blocks WHERE id LIKE 'auto-stream:%' AND date >= ?").run(today);
  if (!settings.streamCalendarEnabled) return;
  if (settings.streamEndTime <= settings.streamStartTime) return;
  const insert = db.prepare(`INSERT OR REPLACE INTO calendar_blocks
    (id,title,date,start_time,end_time,kind,notes,created_at) VALUES (?,?,?,?,?,?,?,?)`);
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  for (let offset = 0; offset < 120; offset += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + offset);
    if (!settings.streamReminderDays.includes(d.getDay())) continue;
    const date = localDateKey(d);
    insert.run(
      `auto-stream:${date}`,
      "Stream",
      date,
      settings.streamStartTime,
      settings.streamEndTime,
      "stream",
      "Автоматически из Stream Scheduler",
      new Date().toISOString()
    );
  }
}

function playPopupSound() {
  const settings = readSettings();
  if (!settings.popupSoundEnabled) return;
  try {
    if (typeof shell.beep === "function") shell.beep();
  } catch (error) {
    console.warn("Could not play popup sound:", error);
  }
}

function showStreamReminder(now = new Date()) {
  const occurrence = localDateKey(now);
  const scheduled = scheduledDateForToday(readSettings().streamReminderTime, now);
  upsertReminderLog("stream-prep", occurrence, {
    status: "shown",
    scheduled_for: scheduled.toISOString(),
    shown_at: now.toISOString(),
    snoozed_until: null,
  });
  playPopupSound();
  notifyStreamPrep();
  createStreamPrepWindow();
}

function checkStreamReminder() {
  if (!db) return;
  const settings = readSettings();
  if (!settings.streamReminderEnabled) return;
  const now = new Date();
  if (!settings.streamReminderDays.includes(now.getDay())) return;
  const scheduled = scheduledDateForToday(settings.streamReminderTime, now);
  if (now < scheduled) return;
  const occurrence = localDateKey(now);
  const log = getReminderLog("stream-prep", occurrence);
  if (!log) {
    showStreamReminder(now);
    return;
  }
  if (log.status === "completed" || log.status === "skipped" || log.status === "shown") return;
  if (log.status === "snoozed") {
    const until = log.snoozed_until ? new Date(log.snoozed_until) : null;
    if (!until || now >= until) showStreamReminder(now);
  }
}

function resetStreamPrepRoutine() {
  const state = loadAppState();
  if (!state) return;
  const next = {
    ...state,
    routines: state.routines.map((r) => r.id === "stream-prep" ? { ...r, items: r.items.map((i) => ({ ...i, checked: false })) } : r),
  };
  saveAppState(next);
  broadcastDataChanged();
}

function handleStreamAction(action) {
  const settings = readSettings();
  const now = new Date();
  const occurrence = localDateKey(now);
  const scheduled = scheduledDateForToday(settings.streamReminderTime, now);
  if (action === "snooze") {
    const until = new Date(now.getTime() + settings.snoozeMinutes * 60_000);
    upsertReminderLog("stream-prep", occurrence, {
      status: "snoozed",
      scheduled_for: scheduled.toISOString(),
      snoozed_until: until.toISOString(),
    });
  } else if (action === "complete") {
    upsertReminderLog("stream-prep", occurrence, {
      status: "completed",
      scheduled_for: scheduled.toISOString(),
      completed_at: now.toISOString(),
      snoozed_until: null,
    });
    resetStreamPrepRoutine();
  } else if (action === "skip") {
    upsertReminderLog("stream-prep", occurrence, {
      status: "skipped",
      scheduled_for: scheduled.toISOString(),
      completed_at: now.toISOString(),
      snoozed_until: null,
    });
    resetStreamPrepRoutine();
  }
  if (streamPrepWindow && !streamPrepWindow.isDestroyed()) streamPrepWindow.close();
}

function startScheduler() {
  if (schedulerTimer) clearInterval(schedulerTimer);
  checkStreamReminder();
  schedulerTimer = setInterval(checkStreamReminder, 30_000);
}

app.setAppUserModelId("com.egor.director");

app.whenReady().then(() => {
  initDatabase();
  const settings = readSettings();
  syncStreamCalendar(settings);
  applyLoginItemSetting(settings.startWithWindows);
  createMainWindow();
  createTray();
  startScheduler();
  updateManager = createUpdateManager({
    getSettings: readSettings,
    onStateChanged: broadcastUpdateState,
    showMainWindow,
    recordEvent: recordUpdateEvent,
  });
  updateManager.start();
  powerMonitor.on("resume", () => {
    setTimeout(checkStreamReminder, 1500);
    setTimeout(() => void updateManager?.check({ manual: false }), 5000);
  });
  app.on("activate", showMainWindow);
});

app.on("before-quit", () => { isQuitting = true; updateManager?.stop(); });
app.on("window-all-closed", () => {
  // Keep the process alive in the tray so scheduled reminders still work.
});

ipcMain.handle("director:app-info", () => ({
  version: app.getVersion(),
  platform: process.platform,
  databasePath: databasePath(),
  userDataPath: app.getPath("userData"),
  packaged: app.isPackaged,
  databaseSchemaVersion: CURRENT_SCHEMA_VERSION,
  databaseMigrationInfo,
  portable: Boolean(process.env.PORTABLE_EXECUTABLE_FILE),
}));

ipcMain.handle("director:load-state", () => loadAppState());
ipcMain.handle("director:save-state", (event, state) => {
  saveAppState(state);
  broadcastDataChanged(event.sender.id);
  return { ok: true };
});
ipcMain.handle("director:migrate-legacy-state", (event, state) => {
  if (!hasAnyState()) saveAppState(state);
  broadcastDataChanged(event.sender.id);
  return { ok: true };
});

ipcMain.handle("director:get-settings", () => publicSettings());
ipcMain.handle("director:save-settings", (_event, next) => {
  const settings = writeSettings(next || {});
  syncStreamCalendar(settings);
  broadcastDataChanged();
  startScheduler();
  updateManager?.refreshConfiguration();
  return settings;
});

ipcMain.handle("director:open-data-folder", async () => {
  await shell.openPath(app.getPath("userData"));
});

ipcMain.handle("director:open-stream-prep", () => {
  playPopupSound();
  createStreamPrepWindow();
});

ipcMain.handle("director:stream-action", (_event, action) => {
  if (["snooze", "complete", "skip"].includes(action)) handleStreamAction(action);
  return { ok: true };
});

ipcMain.handle("director:close-current-window", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.close();
});

ipcMain.handle("director:update-state", () => updateManager?.getState() || { status: "idle", currentVersion: app.getVersion(), percent: 0 });
ipcMain.handle("director:check-updates", () => updateManager?.check({ manual: true }));
ipcMain.handle("director:download-update", () => updateManager?.download());
ipcMain.handle("director:install-update", () => ({ ok: Boolean(updateManager?.install()) }));

ipcMain.handle("director:choose-import-file", async () => {
  const result = await dialog.showOpenDialog({
    title: "Import task list",
    properties: ["openFile"],
    filters: [
      { name: "Task lists", extensions: ["txt", "md", "csv", "tsv", "json"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const filePath = result.filePaths[0];
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 2 * 1024 * 1024) return { canceled: false, error: "Файл больше 2 MB. Для импорта задач это уже подозрительно жирно." };
    const text = fs.readFileSync(filePath, "utf8");
    return { canceled: false, name: path.basename(filePath), text };
  } catch (error) {
    return { canceled: false, error: `Не удалось прочитать файл: ${error.message}` };
  }
});

ipcMain.handle("director:classify-task", async (_event, payload) => {
  const title = String(payload?.title || "").trim();
  if (!title) return { classification: {} };
  try {
    const { client, settings } = await getOpenAIClient();
    if (!client) return { classification: fallbackClassification(title), offline: true };
    const existing = Array.isArray(payload.existingTasks) ? payload.existingTasks.slice(0, 120).map((t) => ({ id: t.id, title: t.title, project: t.project, area: t.area, feature: t.feature, status: t.status })) : [];
    const response = await client.responses.create({
      model: settings.model,
      instructions: `${DIRECTOR_PROMPT}\n${REYTRIEVE_CONTEXT}`,
      input: `Классифицируй новую задачу. Не ставь числовой priority. Верни ТОЛЬКО JSON-объект со следующими полями, когда они уместны:\n{"kind":"dev|stream|personal|work|admin","taskType":"bug|feature|polish|art|ui|vfx|animation|design|admin|personal|work|other","project":"...","area":"...","chapter":"...","feature":"...","tags":["..."],"estimateMinutes":90,"streamFriendly":true,"visual":true,"deepWork":false,"blocking":false,"classificationReason":"кратко почему","classificationConfidence":0.8}\n\nЗАДАЧА: ${title}\n\nСУЩЕСТВУЮЩИЕ ЗАДАЧИ ДЛЯ КОНТЕКСТА:\n${JSON.stringify(existing, null, 2)}`,
    });
    const parsed = parseJsonObject(response.output_text);
    return { classification: parsed || fallbackClassification(title) };
  } catch (error) {
    console.error("Task classify error:", error);
    return { classification: fallbackClassification(title), offline: true };
  }
});

ipcMain.handle("director:analyze-import", async (_event, payload) => {
  const text = String(payload?.text || "").slice(0, 60_000);
  const existingTasks = Array.isArray(payload?.existingTasks) ? payload.existingTasks : [];
  if (!text.trim()) return { suggestions: [], aiUsed: false, summary: "Пустой ввод." };
  try {
    const { client, settings } = await getOpenAIClient();
    if (!client) {
      const suggestions = fallbackImport(text, existingTasks);
      return { suggestions, aiUsed: false, summary: `Локально разобрано ${suggestions.length} строк. Подключи AI для понимания систем, дублей и зависимостей.` };
    }

    const compactExisting = existingTasks.slice(0, 180).map((t) => ({ id: t.id, title: t.title, project: t.project, area: t.area, feature: t.feature, status: t.status }));
    const response = await client.responses.create({
      model: settings.model,
      instructions: `${DIRECTOR_PROMPT}\n${REYTRIEVE_CONTEXT}`,
      input: `Разбери сырой backlog/список задач. Не ранжируй и не ставь priority. Определи контекст, потенциальные дубли, крупные задачи и пригодность для стрима. Ничего не удаляй.\nВерни ТОЛЬКО JSON такого вида:\n{"summary":"1-3 предложения","items":[{"tempId":"u1","title":"...","notes":"...","kind":"dev|stream|personal|work|admin","taskType":"bug|feature|polish|art|ui|vfx|animation|design|admin|personal|work|other","project":"...","area":"...","chapter":"...","feature":"...","tags":["..."],"estimateMinutes":90,"streamFriendly":true,"visual":true,"deepWork":false,"blocking":false,"reason":"почему так классифицировано","possibleDuplicateTaskId":"id существующей задачи или пропусти"}]}\nОдна реальная задача = один item. Если строка является заголовком раздела, используй её как контекст для следующих пунктов, но не создавай отдельную задачу без необходимости. Если задача слишком большая, не дроби молча: оставь её одной и напиши это в notes/reason.\n\nСУЩЕСТВУЮЩИЕ ЗАДАЧИ:\n${JSON.stringify(compactExisting, null, 2)}\n\nСЫРОЙ ИМПОРТ:\n${text}`,
    });
    const parsed = parseJsonObject(response.output_text);
    const items = Array.isArray(parsed?.items) ? parsed.items.slice(0, 250).map((item, index) => ({ ...item, tempId: String(item.tempId || `ai-${index}-${Date.now()}`) })) : [];
    if (!items.length) {
      const suggestions = fallbackImport(text, existingTasks);
      return { suggestions, aiUsed: false, summary: "AI не вернул пригодную структуру, поэтому использован локальный разбор." };
    }
    return { suggestions: items, aiUsed: true, summary: parsed.summary || `Разобрано ${items.length} задач.` };
  } catch (error) {
    console.error("Import analyze error:", error);
    const suggestions = fallbackImport(text, existingTasks);
    return { suggestions, aiUsed: false, summary: "AI-анализ не сработал, поэтому использован локальный разбор." };
  }
});

ipcMain.handle("director:chat", async (_event, payload) => {
  try {
    const { client, settings } = await getOpenAIClient();
    if (!client) {
      return {
        message: "AI пока не подключён. Открой Settings, вставь OpenAI API key и сохрани. Задачи, база, чеклисты и напоминания уже работают локально без него.",
        offline: true,
      };
    }
    const response = await client.responses.create({
      model: settings.model,
      instructions: `${DIRECTOR_PROMPT}\n${REYTRIEVE_CONTEXT}`,
      input: `СЕЙЧАС: ${new Date().toISOString()}\n\nТЕКУЩЕЕ СОСТОЯНИЕ ПРИЛОЖЕНИЯ:\n${JSON.stringify(payload.state, null, 2)}\n\nПОСЛЕДНЕЕ СООБЩЕНИЕ ПОЛЬЗОВАТЕЛЯ:\n${payload.message}`,
    });
    return { message: response.output_text || "Не смог сформировать ответ." };
  } catch (error) {
    console.error("Director chat error:", error);
    return { message: "Не удалось связаться с AI. Локальные данные при этом не потеряны.", offline: true };
  }
});

ipcMain.handle("director:pick", async (_event, payload) => {
  try {
    const { client, settings } = await getOpenAIClient();
    if (!client) return { offline: true };
    const pickState = {
      ...payload.state,
      tasks: Array.isArray(payload.state?.tasks)
        ? payload.state.tasks.filter((task) => !["done", "archived", "inbox"].includes(task.status))
        : [],
    };
    const response = await client.responses.create({
      model: settings.model,
      instructions: `${DIRECTOR_PROMPT}\n${REYTRIEVE_CONTEXT}`,
      input: `Сейчас ${new Date().toISOString()}. Выбери ОДНУ следующую задачу для режима "${payload.mode}".\nНе выбирай задачу, если deferredUntil ещё в будущем. Completed, archived и inbox уже исключены из STATE.\nВерни ТОЛЬКО JSON без markdown: {"taskId":"...","taskTitle":"...","why":"1-2 предложения","caution":"необязательное замечание","estimatedMinutes":90}.\nНе придумывай taskId. Выбирай только из данных.\n\nSTATE:\n${JSON.stringify(pickState, null, 2)}`,
    });
    const pick = parseJsonObject(response.output_text);
    return pick ? { pick } : { offline: true };
  } catch (error) {
    console.error("Director pick error:", error);
    return { offline: true };
  }
});
