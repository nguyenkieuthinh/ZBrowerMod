export const CHANNEL_TTL_MS = 24 * 60 * 60 * 1000;
export const TEXT_TTL_MS = 15 * 60 * 1000;
export const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;
const MAX_CODE_ATTEMPTS = 6;
const CREATE_WINDOW_MS = 60 * 60 * 1000;
const CREATE_WINDOW_LIMIT = 10;
const WRITE_WINDOW_MS = 60 * 1000;
const WRITE_WINDOW_LIMIT = 30;
const ACTIVITY_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export class ChannelStoreError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "ChannelStoreError";
    this.code = code;
    this.status = status;
  }
}

export function normalizeChannelCode(value) {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

export function generateChannelCode(randomBytes = secureRandomBytes) {
  const bytes = randomBytes(8);
  if (!(bytes instanceof Uint8Array) || bytes.length !== 8) {
    throw new TypeError("The random source must return eight bytes.");
  }
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte & 31]).join("");
}

function secureRandomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length));
}

async function hash(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validateText(value) {
  if (typeof value !== "string" || !value.trim() || Array.from(value).length > 5000) {
    throw new ChannelStoreError("invalid_text", "Text must contain 1–5000 characters.");
  }
  return value;
}

function normalizeLanguage(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 64) {
    throw new ChannelStoreError("invalid_language", "Language must be a valid BCP 47 tag.");
  }
  try {
    return Intl.getCanonicalLocales(value)[0];
  } catch {
    throw new ChannelStoreError("invalid_language", "Language must be a valid BCP 47 tag.");
  }
}

async function requireChannel(repository, codeHash, now) {
  const channel = await repository.findChannel(codeHash);
  if (!channel) {
    throw new ChannelStoreError("channel_unavailable", "The channel is unavailable or has expired.", 404);
  }
  if (now - channel.lastActivityAt >= CHANNEL_TTL_MS) {
    await repository.deleteChannel(codeHash);
    throw new ChannelStoreError("channel_unavailable", "The channel is unavailable or has expired.", 404);
  }
  return channel;
}

export async function createChannel(
  repository,
  { now = Date.now(), clientKey = "unknown", randomBytes = secureRandomBytes } = {},
) {
  await repository.cleanup(now);
  const rateKey = await hash(`create:${clientKey}`);
  const allowed = await repository.consumeRateLimit(rateKey, now, CREATE_WINDOW_MS, CREATE_WINDOW_LIMIT);
  if (!allowed) {
    throw new ChannelStoreError("rate_limited", "Too many channels were created. Try again later.", 429);
  }

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateChannelCode(randomBytes);
    const codeHash = await hash(code);
    if (await repository.findChannel(codeHash)) continue;
    const inserted = await repository.insertChannel({
      codeHash,
      createdAt: now,
      lastActivityAt: now,
    });
    if (inserted) return code;
  }

  throw new ChannelStoreError("code_generation_failed", "Could not create a unique channel code.", 503);
}

export async function publishText(
  repository,
  { channelCode, text, language, now = Date.now() },
) {
  const code = normalizeChannelCode(channelCode);
  if (!code) {
    throw new ChannelStoreError("invalid_channel_code", "Enter a valid eight-character channel code.");
  }
  const content = validateText(text);
  const normalizedLanguage = normalizeLanguage(language);

  await repository.cleanup(now);
  const codeHash = await hash(code);
  const channel = await requireChannel(repository, codeHash, now);
  const writeLimitKey = await hash(`write:${codeHash}`);
  const allowed = await repository.consumeRateLimit(writeLimitKey, now, WRITE_WINDOW_MS, WRITE_WINDOW_LIMIT);
  if (!allowed) {
    throw new ChannelStoreError("rate_limited", "This channel is receiving text too quickly. Try again shortly.", 429);
  }

  const item = {
    codeHash,
    content,
    language: normalizedLanguage,
    updatedAt: now,
    expiresAt: now + TEXT_TTL_MS,
  };
  await repository.touchChannel(codeHash, now);
  await repository.putText(item);
  return { text: item.content, language: item.language, updatedAt: item.updatedAt };
}

export async function readLatest(
  repository,
  { channelCode, now = Date.now() },
) {
  const code = normalizeChannelCode(channelCode);
  if (!code) {
    throw new ChannelStoreError("invalid_channel_code", "Enter a valid eight-character channel code.");
  }
  const codeHash = await hash(code);
  const channel = await repository.findChannel(codeHash);
  if (!channel) return null;
  if (now - channel.lastActivityAt >= CHANNEL_TTL_MS) {
    await repository.deleteChannel(codeHash);
    return null;
  }

  if (now - channel.lastActivityAt >= ACTIVITY_TOUCH_INTERVAL_MS) {
    await repository.touchChannel(codeHash, now);
  }

  const item = await repository.getText(codeHash);
  if (!item || item.expiresAt <= now) {
    if (item) await repository.deleteText(codeHash);
    return { text: null, language: null, updatedAt: null };
  }
  return { text: item.content, language: item.language, updatedAt: item.updatedAt };
}

export function createD1ChannelRepository(db) {
  return {
    async cleanup(now) {
      await db.prepare("DELETE FROM channel_text WHERE expires_at <= ?").bind(now).run();
      await db.prepare(
        "DELETE FROM channel_text WHERE code_hash IN (SELECT code_hash FROM channels WHERE last_activity_at <= ?)",
      ).bind(now - CHANNEL_TTL_MS).run();
      await db.prepare("DELETE FROM channels WHERE last_activity_at <= ?")
        .bind(now - CHANNEL_TTL_MS).run();
      await db.prepare("DELETE FROM rate_limits WHERE window_started_at < ?")
        .bind(now - 24 * 60 * 60 * 1000).run();
    },
    async findChannel(codeHash) {
      const row = await db.prepare(
        "SELECT code_hash, created_at, last_activity_at FROM channels WHERE code_hash = ?",
      ).bind(codeHash).first();
      return row ? {
        codeHash: row.code_hash,
        createdAt: row.created_at,
        lastActivityAt: row.last_activity_at,
      } : null;
    },
    async insertChannel(channel) {
      const result = await db.prepare(
        "INSERT OR IGNORE INTO channels (code_hash, created_at, last_activity_at) VALUES (?, ?, ?)",
      ).bind(channel.codeHash, channel.createdAt, channel.lastActivityAt).run();
      return result.meta.changes === 1;
    },
    async deleteChannel(codeHash) {
      await db.prepare("DELETE FROM channel_text WHERE code_hash = ?").bind(codeHash).run();
      await db.prepare("DELETE FROM channels WHERE code_hash = ?").bind(codeHash).run();
    },
    async touchChannel(codeHash, now) {
      await db.prepare("UPDATE channels SET last_activity_at = ? WHERE code_hash = ?")
        .bind(now, codeHash).run();
    },
    async getText(codeHash) {
      const row = await db.prepare(
        "SELECT content, language, updated_at, expires_at FROM channel_text WHERE code_hash = ?",
      ).bind(codeHash).first();
      return row ? {
        content: row.content,
        language: row.language,
        updatedAt: row.updated_at,
        expiresAt: row.expires_at,
      } : null;
    },
    async putText(item) {
      await db.prepare(`
        INSERT INTO channel_text (code_hash, content, language, updated_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(code_hash) DO UPDATE SET
          content = excluded.content,
          language = excluded.language,
          updated_at = excluded.updated_at,
          expires_at = excluded.expires_at
      `).bind(item.codeHash, item.content, item.language, item.updatedAt, item.expiresAt).run();
    },
    async deleteText(codeHash) {
      await db.prepare("DELETE FROM channel_text WHERE code_hash = ?").bind(codeHash).run();
    },
    async consumeRateLimit(keyHash, now, windowMs, maxRequests) {
      const row = await db.prepare(`
        INSERT INTO rate_limits (key_hash, window_started_at, request_count)
        VALUES (?, ?, 1)
        ON CONFLICT(key_hash) DO UPDATE SET
          request_count = CASE
            WHEN ? - window_started_at >= ? THEN 1
            ELSE request_count + 1
          END,
          window_started_at = CASE
            WHEN ? - window_started_at >= ? THEN ?
            ELSE window_started_at
          END
        RETURNING request_count
      `).bind(keyHash, now, now, windowMs, now, windowMs, now).first();
      return row.request_count <= maxRequests;
    },
  };
}
