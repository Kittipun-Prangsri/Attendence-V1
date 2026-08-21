const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const BCRYPT_ROUNDS = 10;

function md5(plain) {
  return crypto.createHash('md5').update(plain).digest('hex');
}

async function verifyPassword(plain, { hash, legacyMd5 } = {}) {
  if (hash) {
    const valid = await bcrypt.compare(plain, hash);
    return { valid, needsUpgrade: false };
  }

  if (legacyMd5) {
    const valid = md5(plain).toLowerCase() === legacyMd5.toLowerCase();
    return { valid, needsUpgrade: valid };
  }

  return { valid: false, needsUpgrade: false };
}

function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

module.exports = { verifyPassword, hashPassword };
