import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: SqlJsDatabase;

const dbPath = process.env.DATABASE_URL || path.join(__dirname, '../../data/database.sqlite');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export async function initDatabase() {
  const SQL = await initSqlJs();

  // Load existing database if it exists
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Initialize tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      github_id TEXT UNIQUE NOT NULL,
      github_username TEXT NOT NULL,
      github_token TEXT NOT NULL,
      github_avatar TEXT,
      email TEXT,
      timezone TEXT DEFAULT 'America/New_York',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS preferences (
      user_id TEXT PRIMARY KEY,
      email_enabled INTEGER DEFAULT 1,
      push_enabled INTEGER DEFAULT 1,
      calendar_enabled INTEGER DEFAULT 0,
      morning_time TEXT DEFAULT '09:00',
      afternoon_time TEXT DEFAULT '15:00',
      evening_time TEXT DEFAULT '20:00',
      weekends_off INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS excluded_repos (
      user_id TEXT,
      repo_full_name TEXT NOT NULL,
      PRIMARY KEY (user_id, repo_full_name)
    );

    CREATE TABLE IF NOT EXISTS commit_log (
      user_id TEXT,
      date TEXT NOT NULL,
      committed INTEGER DEFAULT 0,
      commit_count INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, date)
    );

    CREATE TABLE IF NOT EXISTS streaks (
      user_id TEXT PRIMARY KEY,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_commit_date TEXT
    );
  `);

  saveDatabase();
  return db;
}

export function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

export function getDb(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// Helper functions mimicking better-sqlite3 API
export const dbHelpers = {
  prepare: (sql: string) => ({
    get: (...params: any[]) => {
      const result = db.exec(sql, params);
      if (result.length === 0 || result[0].values.length === 0) return undefined;
      const columns = result[0].columns;
      const values = result[0].values[0];
      const row: any = {};
      columns.forEach((col: string, i: number) => row[col] = values[i]);
      return row;
    },
    all: (...params: any[]) => {
      const result = db.exec(sql, params);
      if (result.length === 0) return [];
      const columns = result[0].columns;
      return result[0].values.map((values: any[]) => {
        const row: any = {};
        columns.forEach((col: string, i: number) => row[col] = values[i]);
        return row;
      });
    },
    run: (...params: any[]) => {
      db.run(sql, params);
      saveDatabase();
      return { changes: db.getRowsModified() };
    }
  })
};

export { db };
