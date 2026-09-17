const { app, Notification } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { NsisUpdater } = require('electron-updater');

function sanitizeRepoPart(value) {
  const text = String(value || '').trim();
  return /^[A-Za-z0-9_.-]+$/.test(text) ? text : '';
}

function createUpdateManager({ getSettings, onStateChanged, showMainWindow, recordEvent }) {
  const logPath = path.join(app.getPath('userData'), 'director-updater.log');
  function log(...parts) {
    try {
      const line = `[${new Date().toISOString()}] ${parts.map((p) => typeof p === 'string' ? p : JSON.stringify(p)).join(' ')}\n`;
      fs.appendFileSync(logPath, line, 'utf8');
    } catch {}
  }
  let updater = null;
  let updaterKey = '';
  let checkTimer = null;
  let startupTimer = null;
  let lastManualCheck = false;
  let state = {
    status: app.isPackaged ? 'idle' : 'dev',
    currentVersion: app.getVersion(),
    availableVersion: undefined,
    percent: 0,
    message: app.isPackaged ? 'Ready to check for updates.' : 'Auto-update is disabled in dev mode.',
    lastCheckedAt: undefined,
    repository: undefined,
    installSupported: !Boolean(process.env.PORTABLE_EXECUTABLE_FILE),
  };

  function emit(patch) {
    state = { ...state, ...patch, currentVersion: app.getVersion() };
    log('state', state.status, state.message || '', state.repository || '');
    try { onStateChanged?.({ ...state }); } catch {}
  }

  function notify(title, body) {
    if (!Notification.isSupported()) return;
    const n = new Notification({ title, body, silent: false });
    n.on('click', () => showMainWindow?.());
    n.show();
  }

  function destroyUpdater() {
    if (updater) updater.removeAllListeners();
    updater = null;
    updaterKey = '';
  }

  function configure({ force = false } = {}) {
    const settings = getSettings();
    const owner = sanitizeRepoPart(settings.updateRepoOwner);
    const repo = sanitizeRepoPart(settings.updateRepoName);
    const key = `${owner}/${repo}`;

    if (!app.isPackaged) {
      destroyUpdater();
      emit({ status: 'dev', repository: key === '/' ? undefined : key, message: 'Update checks work only in an installed/packaged Director.' });
      return null;
    }
    if (!state.installSupported) {
      destroyUpdater();
      emit({ status: 'portable', repository: key === '/' ? undefined : key, message: 'Portable builds cannot self-install updates. Use Director Setup once.' });
      return null;
    }
    if (!owner || !repo) {
      destroyUpdater();
      emit({ status: 'not-configured', repository: undefined, message: 'Set the public GitHub release repository once to enable auto-updates.' });
      return null;
    }
    if (updater && updaterKey === key && !force) return updater;

    destroyUpdater();
    updaterKey = key;
    updater = new NsisUpdater({ provider: 'github', owner, repo, private: false });
    updater.logger = {
      info: (...args) => log('INFO', ...args),
      warn: (...args) => log('WARN', ...args),
      error: (...args) => log('ERROR', ...args),
      debug: (...args) => log('DEBUG', ...args),
    };
    updater.autoDownload = Boolean(settings.autoDownloadUpdates);
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    updater.disableWebInstaller = true;

    updater.on('checking-for-update', () => emit({ status: 'checking', repository: key, message: 'Checking for updates…' }));
    updater.on('update-available', (info) => {
      const nextVersion = info?.version || undefined;
      emit({ status: updater.autoDownload ? 'downloading' : 'available', availableVersion: nextVersion, repository: key, percent: 0, message: updater.autoDownload ? `Director ${nextVersion} found. Downloading…` : `Director ${nextVersion} is available.` });
      recordEvent?.('available', nextVersion, { repository: key });
      if (!lastManualCheck) notify('Director update available', `Version ${nextVersion} is ${updater.autoDownload ? 'downloading in the background.' : 'ready to download.'}`);
    });
    updater.on('update-not-available', (info) => {
      emit({ status: 'up-to-date', availableVersion: undefined, repository: key, percent: 0, lastCheckedAt: new Date().toISOString(), message: `Director ${app.getVersion()} is up to date.` });
    });
    updater.on('download-progress', (progress) => {
      emit({ status: 'downloading', repository: key, percent: Math.max(0, Math.min(100, Number(progress?.percent || 0))), message: `Downloading update… ${Math.round(Number(progress?.percent || 0))}%` });
    });
    updater.on('update-downloaded', (info) => {
      const nextVersion = info?.version || state.availableVersion;
      emit({ status: 'downloaded', availableVersion: nextVersion, repository: key, percent: 100, message: `Director ${nextVersion} is ready. Restart to install.` });
      recordEvent?.('downloaded', nextVersion, { repository: key });
      notify('Director update is ready', `Version ${nextVersion} downloaded. Open Director and press Restart & Update.`);
    });
    updater.on('error', (error) => {
      const message = String(error?.message || error || 'Unknown updater error');
      emit({ status: 'error', repository: key, message, lastCheckedAt: new Date().toISOString() });
      recordEvent?.('error', state.availableVersion || app.getVersion(), { message, repository: key });
    });
    emit({ status: 'idle', repository: key, message: 'Ready to check for updates.' });
    return updater;
  }

  async function check({ manual = false } = {}) {
    lastManualCheck = manual;
    const configured = configure();
    if (!configured) return { ...state };
    const settings = getSettings();
    if (!manual && settings.autoUpdateEnabled === false) {
      emit({ status: 'disabled', message: 'Automatic update checks are disabled.' });
      return { ...state };
    }
    emit({ status: 'checking', repository: updaterKey, message: 'Checking GitHub for updates…' });
    try {
      const timeoutMs = 30000;
      let timeoutId;
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Update check timed out after 30 seconds. Check internet/GitHub access.')), timeoutMs);
      });
      try {
        await Promise.race([configured.checkForUpdates(), timeout]);
      } finally {
        clearTimeout(timeoutId);
      }
      emit({ lastCheckedAt: new Date().toISOString() });
    } catch (error) {
      const message = String(error?.message || error || 'Update check failed');
      log('CHECK_ERROR', message);
      emit({ status: 'error', message, lastCheckedAt: new Date().toISOString() });
    } finally {
      lastManualCheck = false;
    }
    return { ...state };
  }

  async function download() {
    const configured = configure();
    if (!configured) return { ...state };
    try {
      emit({ status: 'downloading', percent: state.percent || 0, message: 'Downloading update…' });
      await configured.downloadUpdate();
    } catch (error) {
      emit({ status: 'error', message: String(error?.message || error || 'Update download failed') });
    }
    return { ...state };
  }

  function install() {
    const configured = configure();
    if (!configured || state.status !== 'downloaded') return false;
    recordEvent?.('installing', state.availableVersion || app.getVersion(), { repository: state.repository });
    setImmediate(() => configured.quitAndInstall(false, true));
    return true;
  }

  function refreshConfiguration() {
    configure({ force: true });
  }

  function start() {
    configure();
    if (startupTimer) clearTimeout(startupTimer);
    if (checkTimer) clearInterval(checkTimer);
    startupTimer = setTimeout(() => void check({ manual: false }), 10_000);
    checkTimer = setInterval(() => void check({ manual: false }), 4 * 60 * 60 * 1000);
  }

  function stop() {
    if (startupTimer) clearTimeout(startupTimer);
    if (checkTimer) clearInterval(checkTimer);
    startupTimer = null;
    checkTimer = null;
    destroyUpdater();
  }

  return {
    getState: () => ({ ...state }),
    check,
    download,
    install,
    start,
    stop,
    refreshConfiguration,
  };
}

module.exports = { createUpdateManager };
