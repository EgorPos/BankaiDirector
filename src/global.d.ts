import type { AppState, DirectorPick, DirectorSettings, ImportSuggestion, Task, UpdateState } from "./lib/types";

export {};

declare global {
  interface Window {
    directorBridge: {
      chat: (state: AppState, message: string) => Promise<{ message: string; offline?: boolean }>;
      pick: (state: AppState, mode: "work" | "stream" | "short" | "visual") => Promise<{ pick?: DirectorPick; offline?: boolean }>;
      classifyTask: (title: string, existingTasks: Task[]) => Promise<{ classification?: Partial<Task>; offline?: boolean }>;
      analyzeImport: (text: string, existingTasks: Task[]) => Promise<{ suggestions: ImportSuggestion[]; aiUsed: boolean; summary?: string }>;
      chooseImportFile: () => Promise<{ canceled: boolean; name?: string; text?: string; error?: string }>;
      loadState: () => Promise<AppState | null>;
      saveState: (state: AppState) => Promise<{ ok: boolean }>;
      migrateLegacyState: (state: AppState) => Promise<{ ok: boolean }>;
      onDataChanged: (callback: () => void) => void;
      getSettings: () => Promise<DirectorSettings>;
      saveSettings: (settings: Partial<DirectorSettings> & { apiKey?: string; clearApiKey?: boolean }) => Promise<DirectorSettings>;
      getAppInfo: () => Promise<{
        version: string;
        platform: string;
        databasePath: string;
        userDataPath: string;
        packaged: boolean;
        portable: boolean;
        databaseSchemaVersion: number;
        databaseMigrationInfo: { fromVersion: number; toVersion: number; backupPath: string | null; migrated: boolean };
      }>;
      openDataFolder: () => Promise<void>;
      openStreamPrep: () => Promise<void>;
      streamAction: (action: "snooze" | "complete" | "skip") => Promise<{ ok: boolean }>;
      closeCurrentWindow: () => Promise<void>;
      getUpdateState: () => Promise<UpdateState>;
      checkForUpdates: () => Promise<UpdateState>;
      downloadUpdate: () => Promise<UpdateState>;
      installUpdate: () => Promise<{ ok: boolean }>;
      onUpdateState: (callback: (state: UpdateState) => void) => void;
    };
  }
}
