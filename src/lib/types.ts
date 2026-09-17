export type Energy = "full" | "normal" | "low" | "dead";
export type TaskStatus = "inbox" | "todo" | "active" | "done" | "deferred";
export type TaskKind = "dev" | "stream" | "personal" | "work" | "admin";
export type TaskType = "bug" | "feature" | "polish" | "art" | "ui" | "vfx" | "animation" | "design" | "admin" | "personal" | "work" | "other";

export interface Task {
  id: string;
  title: string;
  notes?: string;
  status: TaskStatus;
  kind: TaskKind;
  taskType?: TaskType;
  project?: string;
  area?: string;
  chapter?: string;
  feature?: string;
  tags?: string[];
  estimateMinutes?: number;
  streamFriendly?: boolean;
  visual?: boolean;
  deepWork?: boolean;
  blocking?: boolean;
  createdAt: string;
  completedAt?: string;
  deferredUntil?: string;
  deferReason?: string;
  aiReason?: string;
  classificationReason?: string;
  classificationConfidence?: number;
  source?: "manual" | "import" | "seed";
}

export interface RoutineItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface Routine {
  id: string;
  title: string;
  items: RoutineItem[];
}


export type CalendarKind = "work" | "personal" | "reytrieve" | "stream" | "admin" | "other";

export interface CalendarBlock {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD in local time
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  kind: CalendarKind;
  notes?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface AppState {
  tasks: Task[];
  routines: Routine[];
  energy: Energy;
  chat: ChatMessage[];
  calendarBlocks: CalendarBlock[];
}

export interface DirectorPick {
  taskId: string;
  taskTitle: string;
  why: string;
  caution?: string;
  estimatedMinutes?: number;
}

export interface DirectorSettings {
  hasApiKey: boolean;
  model: string;
  streamReminderEnabled: boolean;
  streamReminderDays: number[];
  streamReminderTime: string;
  snoozeMinutes: number;
  startWithWindows: boolean;
  closeToTray: boolean;
  autoUpdateEnabled: boolean;
  autoDownloadUpdates: boolean;
  updateRepoOwner: string;
  updateRepoName: string;
}

export type UpdateStatus =
  | "idle"
  | "dev"
  | "portable"
  | "disabled"
  | "not-configured"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "up-to-date"
  | "error";

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion?: string;
  percent: number;
  message: string;
  lastCheckedAt?: string;
  repository?: string;
  installSupported: boolean;
}

export interface ImportSuggestion {
  tempId: string;
  title: string;
  notes?: string;
  kind: TaskKind;
  taskType?: TaskType;
  project?: string;
  area?: string;
  chapter?: string;
  feature?: string;
  tags?: string[];
  estimateMinutes?: number;
  streamFriendly?: boolean;
  visual?: boolean;
  deepWork?: boolean;
  blocking?: boolean;
  reason?: string;
  possibleDuplicateTaskId?: string;
}
