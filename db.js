const Database = require('better-sqlite3');
const db = new Database('platform.db');

// Initialize tables if not exist
db.prepare(`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  type TEXT
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  ownerId TEXT,
  title TEXT,
  targetAmount INTEGER,
  currentAmount INTEGER DEFAULT 0,
  deadline INTEGER,
  status TEXT DEFAULT 'active'
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  ownerId TEXT,
  balance INTEGER DEFAULT 0,
  type TEXT
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  campaignId TEXT,
  donorPhone TEXT,
  amount INTEGER,
  commission INTEGER,
  createdAt INTEGER
)`).run();

module.exports = db;
