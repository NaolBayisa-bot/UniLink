import { createHmac, timingSafeEqual } from 'crypto';

/**
 * The parsed result of validating a Telegram WebApp initData payload.
 */
export interface TelegramIdentity {
  telegram_id: number;
  telegram_username: string | null;
}

interface TelegramUser {
  id?: number;
  username?: string;
  [key: string]: unknown;
}

/**
 * Derive the secret key Telegram uses to sign initData, per the documented
 * algorithm: HMAC-SHA256(key = bot_token, msg = "WebAppData").
 */
function deriveSecretKey(token: string): Buffer {
  return createHmac('sha256', token).update('WebAppData').digest();
}

/**
 * Decode a query-string-style payload into its raw (decoded) key/value entries.
 */
function parseInitData(initDataRaw: string): Array<[string, string]> {
  return initDataRaw
    .split('&')
    .filter((pair) => pair.length > 0)
    .map((pair) => {
      const eq = pair.indexOf('=');
      if (eq === -1) {
        return [decodeURIComponent(pair), ''] as [string, string];
      }
      const key = decodeURIComponent(pair.slice(0, eq));
      const value = decodeURIComponent(pair.slice(eq + 1));
      return [key, value] as [string, string];
    });
}

/**
 * Validate a Telegram WebApp `initData` payload.
 *
 * Implements Telegram's documented validation:
 *   1. parse the query-string-style payload and extract the `hash`,
 *   2. remove `hash`, sort remaining fields by key,
 *   3. build the data-check string (key=value joined by "\n"),
 *   4. HMAC-SHA256 it with a key derived from TELEGRAM_BOT_TOKEN
 *      (secret = HMAC-SHA256(key=token, msg="WebAppData")),
 *   5. compare the resulting hex hash to the provided one (constant-time).
 *
 * Returns the identity { telegram_id, telegram_username } on success, or null
 * on missing/invalid input or signature mismatch. Throws only when the bot
 * token is not configured (a server configuration error, not a rejection).
 */
export function verifyInitData(
  initDataRaw: string,
): TelegramIdentity | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  }

  if (!initDataRaw || typeof initDataRaw !== 'string') return null;

  const entries = parseInitData(initDataRaw);
  if (entries.length === 0) return null;

  // Extract the provided hash and keep everything else for verification.
  let providedHash: string | null = null;
  const dataEntries: Array<[string, string]> = [];
  for (const [key, value] of entries) {
    if (key === 'hash') {
      providedHash = value;
    } else {
      dataEntries.push([key, value]);
    }
  }

  if (!providedHash || providedHash.length === 0) return null;
  if (dataEntries.length === 0) return null;

  // Sort remaining fields alphabetically by key and build the data-check string.
  dataEntries.sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = dataEntries
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  // Secret key + computed hash for this payload.
  const secretKey = deriveSecretKey(token);
  const expectedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // Compare in constant time (only if both are valid equal-length hex).
  const aBuf = Buffer.from(expectedHash, 'hex');
  const bBuf = Buffer.from(providedHash, 'hex');
  if (aBuf.length !== bBuf.length) return null;
  if (!timingSafeEqual(aBuf, bBuf)) return null;

  // Extract identity from the "user" field (URL-encoded JSON).
  const userEntry = dataEntries.find(([key]) => key === 'user');
  if (!userEntry || !userEntry[1]) return null;

  let user: TelegramUser;
  try {
    user = JSON.parse(userEntry[1]) as TelegramUser;
  } catch {
    return null;
  }

  if (typeof user.id !== 'number') return null;
  return { telegram_id: user.id, telegram_username: user.username ?? null };
}