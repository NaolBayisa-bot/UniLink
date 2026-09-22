import { RequestHandler, Router } from 'express';
import { matchExistsBetween } from '../middleware/authorization';
import { buildPhotoUrl, createUploadSignature } from '../services/cloudinary';
import { getPublicProfile, updateOwnProfile } from '../db/users';
/**
 * Dependencies the photo handlers use. Injectable so tests can run the flow
 * hermetically without touching Cloudinary credentials.
 */
export interface PhotoDeps {
    createUploadSignature?: typeof createUploadSignature;
    updateOwnProfile?: typeof updateOwnProfile;
    matchExistsBetween?: typeof matchExistsBetween;
    getPublicProfile?: typeof getPublicProfile;
    buildPhotoUrl?: typeof buildPhotoUrl;
}
/**
 * POST /photo/upload-signature (mounted at /photo).
 *
 * Returns a Cloudinary signature the client can use to upload a photo directly
 * to Cloudinary. The upload is SCOPED TO THE CALLER: the signed folder is
 * `unilink/users/{req.userId}`.
 *
 * SECURITY INVARIANT: the caller's identity comes ONLY from req.userId (set by
 * jwtAuth). req.body and req.query are never read — a client-supplied user_id or
 * folder can therefore never influence the returned signature.
 */
export declare function createUploadSignatureHandler(deps?: PhotoDeps): RequestHandler;
/**
 * POST /photo/confirm (mounted at /photo).
 *
 * The client calls this AFTER a direct-to-Cloudinary upload succeeds, with the
 * `public_id` Cloudinary assigned. The public_id is stored as the caller's
 * `photo_public_id` (their visible profile photo hook) ONLY IF it lives inside
 * the caller's OWN upload folder `unilink/users/{req.userId}/...`.
 *
 * SECURITY INVARIANT (identity + ownership): the caller comes ONLY from
 * req.userId (set by jwtAuth), and the folder prefix is derived from it. A
 * caller therefore can never confirm someone else's asset as their photo — a
 * mismatched prefix is rejected with 400 BEFORE any database write happens.
 *
 * The trailing slash in the prefix check matters: without it, a sibling folder
 * such as `unilink/users/{callerId}-evil/...` would pass a naive startsWith().
 */
export declare function createConfirmPhotoHandler(deps?: PhotoDeps): RequestHandler;
/**
 * GET /photo/photo-url?target=<userId> (mounted at /photo).
 *
 * Returns a SIGNED Cloudinary delivery URL for `target`'s profile photo:
 * - matched pair → unblurred transform;
 * - not matched  → `e_blur:2000` heavy-blur transform.
 *
 * SECURITY INVARIANT (access decision): whether the photo is blurred is derived
 * EXCLUSIVELY from matchExistsBetween(req.userId, target) (Task 21), which is
 * called on EVERY request — no caching. Query params (or any other client
 * input) can never force the unblurred variant. Both branches are signed URLs,
 * so the blur cannot be stripped client-side either.
 */
export declare function createPhotoUrlHandler(deps?: PhotoDeps): RequestHandler;
/**
 * Express router for /photo endpoints. Mounted behind jwtAuth so every handler
 * can rely on req.userId being present.
 */
export declare function createPhotoRouter(deps?: PhotoDeps): Router;
export declare const photoRouter: Router;
