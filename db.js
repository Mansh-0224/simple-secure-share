/**
 * db.js — a tiny JSON-file "database".
 *
 * This is intentionally NOT a real database. It exists so this project
 * needs zero external services: no Postgres install, no Docker, nothing
 * to configure. Everything lives in data/db.json on disk.
 *
 * This is fine for learning/demo/small personal use. It is NOT suitable
 * for multiple simultaneous writers or large numbers of files/users —
 * for that, use a real database (see the full version of this project).
 */
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'db.json');

const EMPTY_DB = {
  users: [], // { id, email, passwordHash, name, createdAt }
  files: [], // { id, ownerId, originalName, storedName, mimeType, size, checksum, createdAt }
  shares: [], // { id, fileId, token, passwordHash, expiresAt, maxDownloads, downloadCount, createdAt }
};

function ensureDbFile() {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY_DB, null, 2));
  }
}

function readDb() {
  ensureDbFile();
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeDb(db) {
  // Write to a temp file then rename, to avoid corrupting the file if the
  // process is killed mid-write.
  const tmpFile = DB_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2));
  fs.renameSync(tmpFile, DB_FILE);
}

// A very simple write queue so concurrent requests don't clobber each
// other's changes (Node is single-threaded per request, but async I/O
// could interleave two writes without this).
let writeChain = Promise.resolve();

function withDb(mutatorFn) {
  writeChain = writeChain.then(async () => {
    const db = readDb();
    const result = await mutatorFn(db);
    writeDb(db);
    return result;
  });
  return writeChain;
}

module.exports = { readDb, withDb };
