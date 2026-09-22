"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHOTO_BLUR_TRANSFORMATION = exports.PHOTO_ROOT_FOLDER = void 0;
exports.userFolder = userFolder;
exports.createUploadSignature = createUploadSignature;
exports.buildPhotoUrl = buildPhotoUrl;
const cloudinary_1 = __importDefault(require("cloudinary"));
/** Root folder for all user-uploaded photos. */
exports.PHOTO_ROOT_FOLDER = 'unilink/users';
/**
 * The ONLY folder a caller may upload into: a per-user namespace derived from
 * the authenticated user id. This is derived server-side from req.userId and is
 * never taken from the request body/query.
 */
function userFolder(userId) {
    return `${exports.PHOTO_ROOT_FOLDER}/${userId}`;
}
/**
 * Read the Cloudinary credentials at call time (so tests can control the env)
 * and fail loudly, naming every missing variable, when the server is not
 * configured. Mirrors services/jwt.ts and services/telegram.ts.
 */
function readCredentials() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const missing = [
        ['CLOUDINARY_CLOUD_NAME', cloudName],
        ['CLOUDINARY_API_KEY', apiKey],
        ['CLOUDINARY_API_SECRET', apiSecret],
    ]
        .filter(([, value]) => !value)
        .map(([key]) => key);
    if (missing.length > 0) {
        throw new Error(`Cloudinary is not configured: missing ${missing.join(', ')}`);
    }
    return {
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
    };
}
/**
 * Build a Cloudinary upload signature scoped to `folder`.
 *
 * Only `folder` and `timestamp` are signed — exactly the parameters the client
 * must echo back on upload (plus its own `file`/`public_id`, which are not part
 * of the signature). Note the consequence of that shape: because `public_id` is
 * NOT signed, the client chooses the object name inside its own folder.
 *
 * The signature is computed with cloudinary.utils.api_sign_request (SHA-1 over
 * the sorted, blank-filtered params + api_secret) — the SDK's documented default.
 * No global cloudinary.config() call is made: the module stays stateless so it is
 * safe to use in tests without leaking configuration between cases.
 *
 * `timestamp` is injectable purely so signatures are deterministic in tests.
 */
function createUploadSignature(folder, timestamp = Math.floor(Date.now() / 1000)) {
    const { cloud_name, api_key, api_secret } = readCredentials();
    const params = { folder, timestamp };
    const signature = cloudinary_1.default.v2.utils.api_sign_request(params, api_secret);
    return { signature, timestamp, api_key, cloud_name, folder };
}
/**
 * The "hidden" transform applied when the viewer is NOT matched with the photo
 * owner: a heavy blur that only hints at the image's shape/color
 * (renders as `e_blur:2000` in the delivery URL).
 */
exports.PHOTO_BLUR_TRANSFORMATION = [{ effect: 'blur:2000' }];
/**
 * Build a SIGNED Cloudinary delivery URL for `publicId`.
 *
 * `blurred: true` applies PHOTO_BLUR_TRANSFORMATION; otherwise the asset is
 * delivered unblurred. BOTH branches are signed (`sign_url: true` → the
 * `s--XXXXXXXX--` path segment), so a viewer can never strip the blur by
 * editing the transformation out of the URL: Cloudinary recomputes the
 * signature from the delivered URL's transformation and rejects a mismatch.
 *
 * A fresh options object is built on every call — the SDK consumes (deletes)
 * the options keys it reads, so reusing a shared object would silently change
 * later URLs.
 *
 * Throws (naming the missing variable) when Cloudinary is not configured.
 */
function buildPhotoUrl(publicId, opts = {}) {
    const { cloud_name, api_secret } = readCredentials();
    return cloudinary_1.default.v2.utils.url(publicId, {
        sign_url: true,
        secure: true,
        cloud_name,
        api_secret,
        ...(opts.blurred ? { transformation: exports.PHOTO_BLUR_TRANSFORMATION } : {}),
    });
}
//# sourceMappingURL=cloudinary.js.map