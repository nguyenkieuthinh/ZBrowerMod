import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  createChannel,
  generateChannelCode,
  publishText,
  readLatest,
} from "./channel-store.js";

const CODE_TTL = 24 * 60 * 60 * 1000;
const TEXT_TTL = 15 * 60 * 1000;
const codeHash = (value) => createHash("sha256").update(value).digest("hex");

class MemoryRepository {
  channels = new Map();
  texts = new Map();
  limits = new Map();

  async cleanup(now) {
    for (const [key, channel] of this.channels) {
      if (channel.lastActivityAt <= now - CODE_TTL) {
        this.channels.delete(key);
        this.texts.delete(key);
      }
    }
    for (const [key, item] of this.texts) {
      if (item.expiresAt <= now) this.texts.delete(key);
    }
    for (const [key, item] of this.limits) {
      if (item.windowStartedAt < now - 60 * 60 * 1000) this.limits.delete(key);
    }
  }

  async findChannel(hash) { return this.channels.get(hash) || null; }
  async insertChannel(channel) {
    if (this.channels.has(channel.codeHash)) return false;
    this.channels.set(channel.codeHash, channel);
    return true;
  }
  async deleteChannel(hash) {
    this.channels.delete(hash);
    this.texts.delete(hash);
  }
  async touchChannel(hash, now) {
    const channel = this.channels.get(hash);
    if (channel) this.channels.set(hash, { ...channel, lastActivityAt: now });
  }
  async getText(hash) { return this.texts.get(hash) || null; }
  async putText(item) { this.texts.set(item.codeHash, item); }
  async deleteText(hash) { this.texts.delete(hash); }
  async consumeRateLimit(key, now, windowMs, maxRequests) {
    const previous = this.limits.get(key);
    const current = !previous || now - previous.windowStartedAt >= windowMs
      ? { windowStartedAt: now, requestCount: 1 }
      : { ...previous, requestCount: previous.requestCount + 1 };
    this.limits.set(key, current);
    return current.requestCount <= maxRequests;
  }
}

test("generates an eight-character code from the safe alphabet", () => {
  const code = generateChannelCode(() => Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]));
  assert.equal(code, "23456789");
  assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
});

test("retries a code collision and stores only its hash", async () => {
  const repository = new MemoryRepository();
  repository.channels.set(codeHash("23456789"), {
    codeHash: codeHash("23456789"), createdAt: 1, lastActivityAt: 1,
  });
  const randomValues = [
    Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]),
    Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]),
  ];

  const code = await createChannel(repository, {
    now: 100,
    clientKey: "browser-session",
    randomBytes: () => randomValues.shift(),
  });

  assert.equal(code, "3456789A");
  assert.equal(repository.channels.has(codeHash(code)), true);
  assert.equal(repository.channels.has(code), false);
});

test("rejects blank, oversized, and invalid-language text", async () => {
  const repository = new MemoryRepository();
  const code = await createChannel(repository, {
    now: 100,
    clientKey: "browser-session",
    randomBytes: () => Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]),
  });

  await assert.rejects(
    publishText(repository, { channelCode: code, text: " \n ", now: 101 }),
    { code: "invalid_text" },
  );
  await assert.rejects(
    publishText(repository, { channelCode: code, text: "x".repeat(5001), now: 101 }),
    { code: "invalid_text" },
  );
  await assert.rejects(
    publishText(repository, { channelCode: code, text: "Hello", language: "not_a_tag", now: 101 }),
    { code: "invalid_language" },
  );
});

test("keeps the latest text for fifteen minutes and expires it afterward", async () => {
  const repository = new MemoryRepository();
  const code = await createChannel(repository, {
    now: 1000,
    clientKey: "browser-session",
    randomBytes: () => Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]),
  });
  await publishText(repository, {
    channelCode: code, text: "Hello world", language: "en-US", now: 2000,
  });

  const beforeExpiry = await readLatest(repository, { channelCode: code, now: 2000 + TEXT_TTL - 1 });
  const afterExpiry = await readLatest(repository, { channelCode: code, now: 2000 + TEXT_TTL });

  assert.equal(beforeExpiry.text, "Hello world");
  assert.equal(beforeExpiry.language, "en-US");
  assert.equal(afterExpiry.text, null);
});

test("isolates text between channel codes and expires inactive channels", async () => {
  const repository = new MemoryRepository();
  const values = [
    Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]),
    Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]),
  ];
  const options = { now: 100, clientKey: "browser-session", randomBytes: () => values.shift() };
  const first = await createChannel(repository, options);
  const second = await createChannel(repository, options);
  await publishText(repository, { channelCode: first, text: "First channel", now: 200 });

  assert.equal((await readLatest(repository, { channelCode: second, now: 300 })).text, null);
  assert.equal(await readLatest(repository, { channelCode: first, now: 200 + CODE_TTL }), null);
});

test("limits channel creation per browser key without limiting other keys", async () => {
  const repository = new MemoryRepository();
  const options = {
    now: 100,
    clientKey: "browser-session",
    randomBytes: () => Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]),
  };

  for (let index = 0; index < 10; index += 1) {
    await createChannel(repository, { ...options, randomBytes: () => Uint8Array.from(Array.from({ length: 8 }, (_, i) => (index + i) % 32)) });
  }
  await assert.rejects(
    createChannel(repository, { ...options, randomBytes: () => Uint8Array.from([10, 11, 12, 13, 14, 15, 16, 17]) }),
    { code: "rate_limited" },
  );
  assert.match(await createChannel(repository, {
    ...options,
    clientKey: "different-browser",
    randomBytes: () => Uint8Array.from([11, 12, 13, 14, 15, 16, 17, 18]),
  }), /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
});
