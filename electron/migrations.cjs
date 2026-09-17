const fs = require('node:fs');
const path = require('node:path');

const CURRENT_SCHEMA_VERSION = 5;

function tableExists(db, name) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);
  return Boolean(row);
}

function getUserVersion(db) {
  const row = db.prepare('PRAGMA user_version').get();
  const key = row ? Object.keys(row)[0] : null;
  return key ? Number(row[key] || 0) : 0;
}

function setUserVersion(db, version) {
  db.exec(`PRAGMA user_version = ${Number(version) || 0};`);
}

function inferLegacyVersion(db) {
  const explicit = getUserVersion(db);
  if (explicit > 0) return explicit;
  // v0.3 introduced the SQLite schema but did not stamp PRAGMA user_version.
  if (tableExists(db, 'tasks') && tableExists(db, 'routines') && tableExists(db, 'app_meta')) return 1;
  return 0;
}

function createBackup(db, dbPath, fromVersion, toVersion) {
  if (fromVersion <= 0 || !fs.existsSync(dbPath)) return null;
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    // Best effort: the migration itself is still transactional.
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(path.dirname(dbPath), `director-before-schema-${fromVersion}-to-${toVersion}-${stamp}.db`);
  fs.copyFileSync(dbPath, backupPath);
  return backupPath;
}

const migrations = {
  1(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT,
        status TEXT NOT NULL,
        kind TEXT NOT NULL,
        task_type TEXT,
        project TEXT,
        area TEXT,
        chapter TEXT,
        feature TEXT,
        tags_json TEXT,
        estimate_minutes INTEGER,
        stream_friendly INTEGER,
        visual INTEGER,
        deep_work INTEGER,
        blocking INTEGER,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        deferred_until TEXT,
        defer_reason TEXT,
        ai_reason TEXT,
        classification_reason TEXT,
        classification_confidence REAL,
        source TEXT
      );
      CREATE TABLE IF NOT EXISTS routines (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS routine_items (
        id TEXT PRIMARY KEY,
        routine_id TEXT NOT NULL,
        text TEXT NOT NULL,
        checked INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(routine_id) REFERENCES routines(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS reminder_log (
        kind TEXT NOT NULL,
        occurrence_date TEXT NOT NULL,
        status TEXT NOT NULL,
        scheduled_for TEXT,
        shown_at TEXT,
        snoozed_until TEXT,
        completed_at TEXT,
        PRIMARY KEY(kind, occurrence_date)
      );
    `);
  },
  2(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS update_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT NOT NULL,
        event TEXT NOT NULL,
        created_at TEXT NOT NULL,
        details TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_update_history_created_at ON update_history(created_at DESC);
    `);
  },
  3(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS calendar_blocks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        kind TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_calendar_blocks_date_time ON calendar_blocks(date, start_time);
    `);
  },
  4(db) {
    db.exec(`
      ALTER TABLE tasks ADD COLUMN checklist_json TEXT;
    `);
  },
  5(db) {
    db.exec(`
      ALTER TABLE tasks ADD COLUMN archived_at TEXT;
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    `);
  },
};

function runDatabaseMigrations(db, dbPath) {
  const fromVersion = inferLegacyVersion(db);
  if (fromVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(`Director database schema ${fromVersion} is newer than this app supports (${CURRENT_SCHEMA_VERSION}).`);
  }
  if (fromVersion === CURRENT_SCHEMA_VERSION) {
    return { fromVersion, toVersion: fromVersion, backupPath: null, migrated: false };
  }

  const backupPath = createBackup(db, dbPath, fromVersion, CURRENT_SCHEMA_VERSION);
  let current = fromVersion;
  for (let next = fromVersion + 1; next <= CURRENT_SCHEMA_VERSION; next += 1) {
    const migration = migrations[next];
    if (!migration) throw new Error(`Missing database migration ${current} -> ${next}`);
    db.exec('BEGIN IMMEDIATE;');
    try {
      migration(db);
      setUserVersion(db, next);
      db.exec('COMMIT;');
      current = next;
    } catch (error) {
      db.exec('ROLLBACK;');
      throw error;
    }
  }
  return { fromVersion, toVersion: current, backupPath, migrated: true };
}

module.exports = { CURRENT_SCHEMA_VERSION, runDatabaseMigrations };
