import jwt from 'jsonwebtoken';

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
export function signToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  const expiresIn = process.env.JWT_EXPIRES_IN;
  if (!expiresIn) {
    throw new Error('JWT_EXPIRES_IN is not configured');
  }

  return jwt.sign({ sub: userId }, secret, {
    expiresIn,
  } as jwt.SignOptions);
}