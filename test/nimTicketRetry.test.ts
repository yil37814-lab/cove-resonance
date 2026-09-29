import assert from "node:assert/strict";
import test from "node:test";
import { requestChatRoomEnterWithRetry, waitForNimLogin } from "../src/netease/nimTicketRetry.js";

test("waits until the NIM client reports a connected login state", async () => {
  const states = [0, 0, 1];
  const delays: number[] = [];
  let reads = 0;

  await waitForNimLogin({
    getLoginState() {
      const state = states[reads] ?? 1;
      reads += 1;
      return state;
    },
  }, {
    intervalMs: 100,
    delay: async (ms) => { delays.push(ms); },
  });

  assert.equal(reads, 3);
  assert.deepEqual(delays, [100, 100]);
});

test("fails when the NIM login state never becomes connected", async () => {
  await assert.rejects(
    waitForNimLogin({
      getLoginState() { return 0; },
    }, {
      maxChecks: 3,
      intervalMs: 1,
      delay: async () => {},
    }),
    /did not reach the connected state/,
  );
});

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

test("retries a successful response whose chatroom ticket is still empty", async () => {
  const results: Array<[number, string]> = [
    [200, ""],
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
  assert.equal(calls, 2);
  assert.deepEqual(delays, [250]);
});

test("retries an empty ticket even when NIM uses another transient status code", async () => {
  const results: Array<[number, string]> = [
    [0, ""],
    [408, ""],
    [200, "ticket"],
  ];
  let calls = 0;

  const result = await requestChatRoomEnterWithRetry({
    async chatRoomRequestEnterAsync() {
      const next = results[calls];
      calls += 1;
      return next;
    },
  }, 123, {
    delay: async () => {},
  });

  assert.deepEqual(result, [200, "ticket"]);
  assert.equal(calls, 3);
});

test("does not retry non-connection failures with a non-empty response payload", async () => {
  let calls = 0;
  const result = await requestChatRoomEnterWithRetry({
    async chatRoomRequestEnterAsync() {
      calls += 1;
      return [403, "error-payload"];
    },
  }, 123, {
    delay: async () => { throw new Error("unexpected delay"); },
  });

  assert.deepEqual(result, [403, "error-payload"]);
  assert.equal(calls, 1);
});

test("fails after the configured maximum number of 415 responses", async () => {
  let calls = 0;
  const delays: number[] = [];
  await assert.rejects(
    requestChatRoomEnterWithRetry({
      async chatRoomRequestEnterAsync() {
        calls += 1;
        return [415, ""];
      },
    }, 123, {
      maxAttempts: 4,
      baseDelayMs: 100,
      maxDelayMs: 150,
      delay: async (ms) => { delays.push(ms); },
    }),
    /code=415 emptyTicket=true/,
  );

  assert.equal(calls, 4);
  assert.deepEqual(delays, [100, 150, 150]);
});
