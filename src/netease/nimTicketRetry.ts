export const NIM_CONNECTION_ERROR_CODE = 415;

type ChatRoomTicketRequester = {
  chatRoomRequestEnterAsync(roomId: number, cb: null, extension: string): Promise<[number, string]>;
};

type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  delay?: (ms: number) => Promise<void>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestChatRoomEnterWithRetry(
  plugin: ChatRoomTicketRequester,
  roomId: number,
  options: RetryOptions = {},
): Promise<[number, string]> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 6);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 250);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 2_000);
  const delay = options.delay ?? sleep;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await plugin.chatRoomRequestEnterAsync(roomId, null, "");
    if (result[0] !== NIM_CONNECTION_ERROR_CODE || attempt === maxAttempts) return result;

    const waitMs = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
    await delay(waitMs);
  }

  throw new Error("NIM chatroom ticket retry loop ended unexpectedly");
}
