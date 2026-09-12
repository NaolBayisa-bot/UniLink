"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = jwtAuth;
const crypto_1 = require("crypto");
const HMAC_ALGORITHMS = {
    HS256: 'sha256',
    HS384: 'sha384',
    HS512: 'sha512',
};
/** Decode a base64url string to a Buffer (no padding required). */
function base64UrlDecode(input) {
    let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0)
        base64 += '=';
    return Buffer.from(base64, 'base64');
}
/**
 * Verify a compact JWS (JWT) signed with an HMAC using JWT_SECRET.
 * Returns the decoded payload on success, or null on any invalid input,
 * tampered signature, unsupported algorithm, or expired token.
 */
function verifyToken(token) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not configured');
    }
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some((p) => p.length === 0))
        return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    // Parse and validate the header.
    let header;
    try {
        header = JSON.parse(base64UrlDecode(headerB64).toString('utf8'));
    }
    catch {
        return null;
    }
    const hashAlg = header.alg ? HMAC_ALGORITHMS[header.alg] : undefined;
    if (!hashAlg)
        return null; // only HMAC-signed tokens using JWT_SECRET are accepted
    // Recompute the expected signature and compare in constant time.
    const signingInput = `${headerB64}.${payloadB64}`;
    const expectedSig = (0, crypto_1.createHmac)(hashAlg, secret).update(signingInput).digest();
    let providedSig;
    try {
        providedSig = base64UrlDecode(signatureB64);
    }
    catch {
        return null;
    }
    if (providedSig.length !== expectedSig.length)
        return null;
    if (!(0, crypto_1.timingSafeEqual)(providedSig, expectedSig))
        return null;
    // Parse the payload.
    let payload;
    try {
        payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));
    }
    catch {
        return null;
    }
    // Reject expired tokens.
    if (payload.exp !== undefined) {
        const nowSec = Math.floor(Date.now() / 1000);
        if (typeof payload.exp !== 'number' || payload.exp < nowSec)
            return null;
    }
    return payload;
}
/**
 * Express middleware that authenticates the caller via a Bearer JWT.
 *
 * On success it attaches `req.userId` (the token's `sub` claim) and calls next().
 * On missing, malformed, invalid, or expired tokens it responds 401 without
 * proceeding to the route.
 */
function jwtAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or malformed Authorization header' });
        return;
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
        res.status(401).json({ error: 'Missing token' });
        return;
    }
    let payload;
    try {
        payload = verifyToken(token);
    }
    catch (error) {
        console.error('JWT verification failed:', error);
        res.status(500).json({ error: 'Authentication is not configured' });
        return;
    }
    if (!payload || typeof payload.sub !== 'string' || payload.sub.length === 0) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
    }
    // The authenticated caller's identity.
    req.userId = payload.sub;
    next();
}
//# sourceMappingURL=jwt-auth.js.map