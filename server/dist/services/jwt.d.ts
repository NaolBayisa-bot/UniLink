/**
 * Sign a JWT for the given user, embedding `sub: userId`.
 *
 * Uses JWT_SECRET and JWT_EXPIRES_IN from the environment. The token is issued
 * as a standard HS256 JWT (the jsonwebtoken default), which is exactly the
 * scheme the jwt-auth middleware verifies.
 *
 * IMPORTANT: this is intended to be called ONLY from the auth-completion flow
 * (the next task). It must NOT be called directly from route handlers.
 */
export declare function signToken(userId: string): string;
