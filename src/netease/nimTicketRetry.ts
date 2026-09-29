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


type LoginStateReader = {
  getLoginState(extension: string): number;
};


type LoginWaitOptions = {
  maxChecks?: number;
  intervalMs?: number;
  delay?: (ms: number) => Promise<void>;
};


function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


export async function waitForNimLogin(
  client: LoginStateReader,
  options: LoginWaitOptions = {},
): Promise<void> {
  const maxChecks = Math.max(1, options.maxChecks ?? 51);
  const intervalMs = Math.max(0, options.intervalMs ?? 200);
  const delay = options.delay ?? sleep;


  for (let check = 1; check <= maxChecks; check += 1) {
    if (client.getLoginState("") === 1) return;
    if (check < maxChecks) await delay(intervalMs);
  }


  throw new Error("NIM login did not reach the connected state before timeout");
}


export async function requestChatRoomEnterWithRetry(
  plugin: ChatRoomTicketRequester,
  roomId: number,
  options: RetryOptions = {},
): Promise<[number, string]> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 9);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 250);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 2_000);
  const delay = options.delay ?? sleep;


  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await plugin.chatRoomRequestEnterAsync(roomId, null, "");
    const [code, ticket] = result;
    const retryable = code === NIM_CONNECTION_ERROR_CODE || !ticket.trim();
    if (!retryable) return result;
    if (attempt === maxAttempts) {
      throw new Error(
        `NIM chatroom enter ticket unavailable code=${code}`
