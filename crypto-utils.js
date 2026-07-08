const crypto = require('crypto');

function getKey() {
  const keyHex = process.env.FILE_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('FILE_ENCRYPTION_KEY must be a 64-character hex string. See .env.example.');
  }
  return Buffer.from(keyHex, 'hex');
}

// Layout of the encrypted file on disk: [12-byte IV][16-byte auth tag][ciphertext]
function encryptBuffer(buffer) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

function decryptBuffer(payload) {
  const key = getKey();
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function randomToken(bytes = 20) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = { encryptBuffer, decryptBuffer, sha256Hex, randomToken };
