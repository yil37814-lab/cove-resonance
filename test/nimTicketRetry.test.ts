import assert from "node:assert/strict";
import test from "node:test";
import { requestChatRoomEnterWithRetry } from "../src/netease/nimTicketRetry.js";

test("retries connection error 415 in the same NIM bootstrap process", async () => {
  const results: Array<[number, string]> = [
    [415, ""],
    [415, ""],
    [200, "ticket"],
  ];
  const delays: number[] = [];
  let calls = 0;

  const result = await requestChatRoomEnterWithRetry({
    async chatRoomRequestEnterAsync() {
      const next = results[calls];
      calls += 1;
      return next;
    },
  }, 123, {
    delay: async (ms) => { delays.push(ms); },
  });

  assert.deepEqual(result, [200, "ticket"]);
  assert.equal(calls, 3);
  assert.deepEqual(delays, [250, 500]);
});

test("does not retry non-connection ticket failures", async () => {
  let calls = 0;
  const result = await requestChatRoomEnterWithRetry({
    async chatRoomRequestEnterAsync() {
      calls += 1;
      return [403, ""];
    },
  }, 123, {
    delay: async () => { throw new Error("unexpected delay"); },
  });

  assert.deepEqual(result, [403, ""]);
  assert.equal(calls, 1);
});

test("stops after the configured maximum number of 415 responses", async () => {
  let calls = 0;
  const delays: number[] = [];
  const result = await requestChatRoomEnterWithRetry({
    async chatRoomRequestEnterAsync() {
      calls += 1;
      return [415, ""];
    },
  }, 123, {
    maxAttempts: 4,
    baseDelayMs: 100,
    maxDelayMs: 150,
    delay: async (ms) => { delays.push(ms); },
  });

  assert.deepEqual(result, [415, ""]);
  assert.equal(calls, 4);
  assert.deepEqual(delays, [100, 150, 150]);
});
