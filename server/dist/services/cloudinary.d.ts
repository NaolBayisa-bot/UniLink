/**
 * A signed direct-upload payload handed to the client so it can upload an image
 * straight to Cloudinary without ever seeing the api_secret.
 *
 * `folder` is chosen by the SERVER (never the client) and is part of what gets
 * signed, so a client cannot retarget the upload to another folder — Cloudinary
 * recomputes the signature from the submitted params and rejects a mismatch.
 */
export interface UploadSignature {
    signature: string;
    timestamp: number;
    api_key: string;
    cloud_name: string;
    folder: string;
}
/** Root folder for all user-uploaded photos. */
export declare const PHOTO_ROOT_FOLDER = "unilink/users";
/**
 * The ONLY folder a caller may upload into: a per-user namespace derived from
 * the authenticated user id. This is derived server-side from req.userId and is
 * never taken from the request body/query.
 */
export declare function userFolder(userId: string): string;
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
export declare function createUploadSignature(folder: string, timestamp?: number): UploadSignature;
/**
 * The "hidden" transform applied when the viewer is NOT matched with the photo
 * owner: a heavy blur that only hints at the image's shape/color
 * (renders as `e_blur:2000` in the delivery URL).
 */
export declare const PHOTO_BLUR_TRANSFORMATION: {
    effect: string;
}[];
export interface BuildPhotoUrlOptions {
    /** true → apply the blur transform (the non-matched branch). */
    blurred?: boolean;
}
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
export declare function buildPhotoUrl(publicId: string, opts?: BuildPhotoUrlOptions): string;
