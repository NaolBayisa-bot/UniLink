import { TokenPayload } from 'google-auth-library';
/**
 * The identity claims returned after a successful Google ID token verification.
 */
export interface GoogleIdentity {
    email: string;
    email_verified: boolean;
    sub: string;
}
/**
 * The verifier abstraction over google-auth-library's LoginTicket. Injected so
 * tests can validate logic without calling Google or holding a real client ID.
 */
export type IdTokenVerifier = (idToken: string, audience: string) => Promise<TokenPayload | undefined>;
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
export declare function verifyGoogleIdToken(idToken: string, pendingVerifier?: IdTokenVerifier): Promise<GoogleIdentity | null>;
