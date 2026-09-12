import { NextFunction, Request, Response } from 'express';
declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}
/**
 * Express middleware that authenticates the caller via a Bearer JWT.
 *
 * On success it attaches `req.userId` (the token's `sub` claim) and calls next().
 * On missing, malformed, invalid, or expired tokens it responds 401 without
 * proceeding to the route.
 */
export default function jwtAuth(req: Request, res: Response, next: NextFunction): void;
