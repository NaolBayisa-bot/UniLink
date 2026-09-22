"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.photoRouter = void 0;
exports.createUploadSignatureHandler = createUploadSignatureHandler;
exports.createConfirmPhotoHandler = createConfirmPhotoHandler;
exports.createPhotoUrlHandler = createPhotoUrlHandler;
exports.createPhotoRouter = createPhotoRouter;
const express_1 = require("express");
const authorization_1 = require("../middleware/authorization");
const cloudinary_1 = require("../services/cloudinary");
const users_1 = require("../db/users");
const PUBLIC_ID_MAX = 255;
/**
 * Postgres accepts UUIDs only in the 8-4-4-4-12 hex form; checking the shape
 * here (400) stops malformed ?target= values from reaching the `::uuid` cast
 * inside the match query, which would otherwise surface as a 500.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
function createUploadSignatureHandler(deps = {}) {
    const doSign = deps.createUploadSignature ?? cloudinary_1.createUploadSignature;
    return async (req, res) => {
        try {
            const callerId = req.userId;
            if (!callerId) {
                throw new authorization_1.HttpError(401, 'Authentication required');
            }
            const folder = (0, cloudinary_1.userFolder)(callerId);
            const payload = await doSign(folder);
            res.status(200).json(payload);
        }
        catch (err) {
            if (err instanceof authorization_1.HttpError) {
                res.status(err.status).json({ error: err.message });
                return;
            }
            // Typically a missing/incorrect Cloudinary configuration.
            console.error('photo upload-signature failed:', err);
            res.status(500).json({ error: 'Failed to create upload signature' });
        }
    };
}
/**
 * Validate the client-supplied Cloudinary public_id: a non-empty string (after
 * trimming) of at most PUBLIC_ID_MAX characters.
 */
function validatePublicId(v) {
    if (typeof v !== 'string') {
        throw new authorization_1.HttpError(400, 'public_id is required and must be a string');
    }
    const trimmed = v.trim();
    if (trimmed.length === 0) {
        throw new authorization_1.HttpError(400, 'public_id must be non-empty');
    }
    if (trimmed.length > PUBLIC_ID_MAX) {
        throw new authorization_1.HttpError(400, `public_id must be at most ${PUBLIC_ID_MAX} characters`);
    }
    return trimmed;
}
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
function createConfirmPhotoHandler(deps = {}) {
    const doUpdate = deps.updateOwnProfile ?? users_1.updateOwnProfile;
    return async (req, res) => {
        try {
            const callerId = req.userId;
            if (!callerId) {
                throw new authorization_1.HttpError(401, 'Authentication required');
            }
            const body = (req.body ?? {});
            const publicId = validatePublicId(body.public_id);
            const allowedPrefix = `${(0, cloudinary_1.userFolder)(callerId)}/`;
            if (!publicId.startsWith(allowedPrefix)) {
                throw new authorization_1.HttpError(400, 'public_id must be within your own upload folder');
            }
            const result = await doUpdate(callerId, { photo_public_id: publicId });
            if (result.rowCount === 0) {
                throw new authorization_1.HttpError(404, 'User not found');
            }
            res.status(200).json({ ok: true, photo_public_id: publicId });
        }
        catch (err) {
            if (err instanceof authorization_1.HttpError) {
                res.status(err.status).json({ error: err.message });
                return;
            }
            console.error('photo confirm failed:', err);
            res.status(500).json({ error: 'Failed to confirm photo upload' });
        }
    };
}
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
function createPhotoUrlHandler(deps = {}) {
    const doMatch = deps.matchExistsBetween ?? authorization_1.matchExistsBetween;
    const doGetPublic = deps.getPublicProfile ?? users_1.getPublicProfile;
    const doBuildUrl = deps.buildPhotoUrl ?? cloudinary_1.buildPhotoUrl;
    return async (req, res) => {
        try {
            const callerId = req.userId;
            if (!callerId) {
                throw new authorization_1.HttpError(401, 'Authentication required');
            }
            const rawTarget = req.query.target;
            if (typeof rawTarget !== 'string' || rawTarget.trim().length === 0) {
                throw new authorization_1.HttpError(400, 'target query parameter is required');
            }
            const target = rawTarget.trim();
            if (!UUID_PATTERN.test(target)) {
                throw new authorization_1.HttpError(400, 'target must be a valid user id');
            }
            // Re-evaluated on EVERY request (deliberately no caching): a match made
            // or broken between two requests must be reflected immediately.
            const matched = await doMatch(callerId, target);
            const profile = await doGetPublic(target);
            if (!profile) {
                throw new authorization_1.HttpError(404, 'User not found');
            }
            if (!profile.photo_public_id) {
                throw new authorization_1.HttpError(404, 'User has no photo');
            }
            // The blurred/unblurred choice comes ONLY from the matcher — never from
            // the request. Note: per spec, self-view is NOT special-cased, so
            // viewing your own photo without a (self-)match row is blurred too.
            const blurred = !matched;
            const url = doBuildUrl(profile.photo_public_id, { blurred });
            res.status(200).json({ url, blurred });
        }
        catch (err) {
            if (err instanceof authorization_1.HttpError) {
                res.status(err.status).json({ error: err.message });
                return;
            }
            // Typically a missing/incorrect Cloudinary configuration or a DB failure.
            console.error('photo url failed:', err);
            res.status(500).json({ error: 'Failed to build photo url' });
        }
    };
}
/**
 * Express router for /photo endpoints. Mounted behind jwtAuth so every handler
 * can rely on req.userId being present.
 */
function createPhotoRouter(deps = {}) {
    const router = (0, express_1.Router)();
    router.post('/upload-signature', createUploadSignatureHandler(deps));
    router.post('/confirm', createConfirmPhotoHandler(deps));
    router.get('/photo-url', createPhotoUrlHandler(deps));
    return router;
}
exports.photoRouter = createPhotoRouter();
//# sourceMappingURL=photo.js.map