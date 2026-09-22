"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyGoogleIdToken = verifyGoogleIdToken;
const google_auth_library_1 = require("google-auth-library");
/**
 * Default verifier: validates the token's signature, issuer, and audience using
 * Google's OAuth2Client.verifyIdToken. An expired or otherwise invalid token
 * yields no payload (getPayload() returns undefined).
 */
function googleVerifier(client) {
    return async (idToken, audience) => {
        const ticket = await client.verifyIdToken({ idToken, audience });
        return ticket.getPayload();
    };
}
/**
 * Verify a Google ID token issued for our OAuth app.
 *
 * Delegates signature, issuer, audit, and expiry validation to
 * google-auth-library's OAuth2Client.verifyIdToken({ idToken, audience }).
 *
 * We never generate, hash, store, or send an OAuth code ourselves — Google has
 * already confirmed the email is real, so we rely on its `email_verified`.
 *
 * Returns { email, email_verified, sub } on success, or null if:
 *  - verification throws (bad signature / issuer / audience),
 *  - the payload is missing (token expired or invalid),
 *  - the payload's email_verified claim is false.
 *
 * Throws only when GOOGLE_CLIENT_ID is not configured (a config error).
 */
async function verifyGoogleIdToken(idToken, pendingVerifier) {
    const audience = process.env.GOOGLE_CLIENT_ID;
    if (!audience) {
        throw new Error('GOOGLE_CLIENT_ID is not configured');
    }
    const verifier = pendingVerifier ?? googleVerifier(new google_auth_library_1.OAuth2Client());
    let payload;
    try {
        payload = await verifier(idToken, audience);
    }
    catch {
        // Signature / issuer / audience / expiry failure.
        return null;
    }
    if (!payload || payload.email_verified !== true) {
        return null;
    }
    if (!payload.email || !payload.sub) {
        return null;
    }
    return { email: payload.email, email_verified: true, sub: payload.sub };
}
//# sourceMappingURL=google.js.map