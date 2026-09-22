/**
 * The parsed result of validating a Telegram WebApp initData payload.
 */
export interface TelegramIdentity {
    telegram_id: number;
    telegram_username: string | null;
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
export declare function verifyInitData(initDataRaw: string): TelegramIdentity | null;
