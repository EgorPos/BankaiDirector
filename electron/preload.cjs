const { contextBridge, ipcRenderer } = require("electron");

let dataChangedListener = null;
let updateStateListener = null;

contextBridge.exposeInMainWorld("directorBridge", {
  chat: (state, message) => ipcRenderer.invoke("director:chat", { state, message }),
  pick: (state, mode, excludeTaskIds = []) => ipcRenderer.invoke("director:pick", { state, mode, excludeTaskIds }),
  classifyTask: (title, existingTasks) => ipcRenderer.invoke("director:classify-task", { title, existingTasks }),
  analyzeTasks: (tasks) => ipcRenderer.invoke("director:analyze-tasks", { tasks }),
  analyzeImport: (text, existingTasks) => ipcRenderer.invoke("director:analyze-import", { text, existingTasks }),
  chooseImportFile: () => ipcRenderer.invoke("director:choose-import-file"),
  loadState: () => ipcRenderer.invoke("director:load-state"),
  saveState: (state) => ipcRenderer.invoke("director:save-state", state),
  migrateLegacyState: (state) => ipcRenderer.invoke("director:migrate-legacy-state", state),
  onDataChanged: (callback) => {
    if (dataChangedListener) ipcRenderer.removeListener("director:data-changed", dataChangedListener);
    dataChangedListener = () => callback();
    ipcRenderer.on("director:data-changed", dataChangedListener);
  },
  getSettings: () => ipcRenderer.invoke("director:get-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("director:save-settings", settings),
  getAppInfo: () => ipcRenderer.invoke("director:app-info"),
  openDataFolder: () => ipcRenderer.invoke("director:open-data-folder"),
  openStreamPrep: () => ipcRenderer.invoke("director:open-stream-prep"),
  streamAction: (action) => ipcRenderer.invoke("director:stream-action", action),
  getReminderStatus: () => ipcRenderer.invoke("director:reminder-status"),
  closeCurrentWindow: () => ipcRenderer.invoke("director:close-current-window"),
  getUpdateState: () => ipcRenderer.invoke("director:update-state"),
  checkForUpdates: () => ipcRenderer.invoke("director:check-updates"),
  downloadUpdate: () => ipcRenderer.invoke("director:download-update"),
  installUpdate: () => ipcRenderer.invoke("director:install-update"),
  onUpdateState: (callback) => {
    if (updateStateListener) ipcRenderer.removeListener("director:update-state", updateStateListener);
    updateStateListener = (_event, state) => callback(state);
    ipcRenderer.on("director:update-state", updateStateListener);
  },
});
