"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const photo_1 = require("./photo");
// The authenticated caller (identity set on req.userId by jwtAuth).
const CALLER_ID = 'c074b9cb-48f0-4900-9040-2718ad82ce55';
// A malicious id a client might sneak into the body to try to upload into
// SOMEONE ELSE's folder.
const SPOOFED_ID = '1a2b3c4d-5e6f-4a5b-9c8d-0e1f2a3b4c5d';
// A valid, DIFFERENT user id used as the ?target= for photo-url tests.
const OTHER = 'b7e3d1a2-4c5d-4e6f-8a9b-0c1d2e3f4a5b';
const SIGNED = {
    signature: 'abc123',
    timestamp: 1700000000,
    api_key: 'test-key',
    cloud_name: 'test-cloud',
    folder: `unilink/users/${CALLER_ID}`,
};
/** Build a handler with controllable fakes and run it against mock req/res. */
async function call(opts, endpoint) {
    const calls = [];
    const deps = {
        createUploadSignature: ((folder) => {
            calls.push({ name: 'createUploadSignature', args: [folder] });
            if (opts.signThrows)
                throw new Error('cloudinary not configured');
            return opts.payload ?? SIGNED;
        }),
    };
    if (endpoint === 'confirm') {
        deps.updateOwnProfile = (async (userId, fields) => {
            calls.push({ name: 'updateOwnProfile', args: [userId, fields] });
            if (opts.updateCalls)
                opts.updateCalls.push({ userId, fields });
            if (opts.updateThrows)
                throw new Error('db down');
            return opts.updateResult ?? { rowCount: 1 };
        });
    }
    if (endpoint === 'photo-url') {
        deps.matchExistsBetween = (async (a, b) => {
            calls.push({ name: 'matchExistsBetween', args: [a, b] });
            if (opts.matchCalls)
                opts.matchCalls.push([a, b]);
            if (opts.matchThrows)
                throw new Error('db down');
            return opts.matchResult ?? false;
        });
        deps.getPublicProfile = (async (userId) => {
            calls.push({ name: 'getPublicProfile', args: [userId] });
            if (opts.profile !== undefined)
                return opts.profile;
            return {
                id: userId,
                nickname: 'Target',
                gender: null,
                photo_public_id: `unilink/users/${userId}/avatar.png`,
                custom_interest_text: null,
                created_at: new Date(0),
            };
        });
        deps.buildPhotoUrl = ((publicId, o) => {
            calls.push({ name: 'buildPhotoUrl', args: [publicId, o] });
            if (opts.urlBuilderCalls) {
                opts.urlBuilderCalls.push({ publicId, blurred: o?.blurred === true });
            }
            if (opts.urlBuilderThrows)
                throw new Error('cloudinary not configured');
            const base = 'https://res.cloudinary.com/demo-cloud/image/upload/s--FAKESIG--';
            return o?.blurred ? `${base}/e_blur:2000/v1/${publicId}` : `${base}/v1/${publicId}`;
        });
    }
    const handler = endpoint === 'confirm'
        ? (0, photo_1.createConfirmPhotoHandler)(deps)
        : endpoint === 'photo-url'
            ? (0, photo_1.createPhotoUrlHandler)(deps)
            : (0, photo_1.createUploadSignatureHandler)(deps);
    let status = 0;
    let body;
    const req = {
        body: opts.body ?? {},
        query: opts.query ?? {},
        userId: opts.userId,
    };
    const res = {
        status(code) {
            status = code;
            return { json: (b) => { body = b; } };
        },
    };
    await handler(req, res, () => undefined);
    return { status, body, calls };
}
(0, node_test_1.describe)('POST /photo/upload-signature', () => {
    (0, node_test_1.it)('200 and returns the signed payload verbatim', async () => {
        const { status, body } = await call({ userId: CALLER_ID }, 'upload-signature');
        strict_1.default.equal(status, 200);
        strict_1.default.deepEqual(body, SIGNED);
        strict_1.default.deepEqual(Object.keys(body).sort(), [
            'api_key',
            'cloud_name',
            'folder',
            'signature',
            'timestamp',
        ]);
    });
    (0, node_test_1.it)('signs a folder scoped to the caller: unilink/users/{req.userId}', async () => {
        const { status, calls } = await call({ userId: CALLER_ID }, 'upload-signature');
        strict_1.default.equal(status, 200);
        strict_1.default.equal(calls.length, 1);
        strict_1.default.deepEqual(calls[0].args, [`unilink/users/${CALLER_ID}`]);
    });
    (0, node_test_1.it)('ignores a spoofed user_id / folder in the body — identity comes from req.userId', async () => {
        const { status, calls, body } = await call({
            userId: CALLER_ID,
            body: { user_id: SPOOFED_ID, folder: `unilink/users/${SPOOFED_ID}` },
            query: { user_id: SPOOFED_ID },
        }, 'upload-signature');
        strict_1.default.equal(status, 200);
        strict_1.default.deepEqual(calls[0].args, [`unilink/users/${CALLER_ID}`]);
        strict_1.default.ok(calls.every((c) => !JSON.stringify(c.args).includes(SPOOFED_ID)), 'spoofed identity must never be used as an argument');
        strict_1.default.ok(!JSON.stringify(body).includes(SPOOFED_ID), 'spoofed identity must never leak into the response');
    });
    (0, node_test_1.it)('401 when req.userId is missing and the signer is never called', async () => {
        const { status, calls } = await call({ body: { user_id: SPOOFED_ID } }, 'upload-signature');
        strict_1.default.equal(status, 401);
        strict_1.default.equal(calls.length, 0, 'no signature should be issued without an authenticated identity');
    });
    (0, node_test_1.it)('500 when the signature service throws (e.g. unconfigured Cloudinary)', async () => {
        const { status, body } = await call({ userId: CALLER_ID, signThrows: true }, 'upload-signature');
        strict_1.default.equal(status, 500);
        strict_1.default.deepEqual(body, { error: 'Failed to create upload signature' });
    });
});
(0, node_test_1.describe)('POST /photo/confirm', () => {
    (0, node_test_1.it)('200 and stores the public_id scoped to the caller via updateOwnProfile', async () => {
        const publicId = `unilink/users/${CALLER_ID}/nested/dir/img-123`;
        const updateCalls = [];
        const { status, body, calls } = await call({ userId: CALLER_ID, body: { public_id: publicId }, updateCalls }, 'confirm');
        strict_1.default.equal(status, 200);
        strict_1.default.deepEqual(body, { ok: true, photo_public_id: publicId });
        strict_1.default.equal(calls.length, 1);
        strict_1.default.deepEqual(calls[0].args, [CALLER_ID, { photo_public_id: publicId }]);
        strict_1.default.deepEqual(updateCalls, [{ userId: CALLER_ID, fields: { photo_public_id: publicId } }]);
    });
    (0, node_test_1.it)("400 and never stores when public_id points at ANOTHER user's folder (prefix mismatch)", async () => {
        const updateCalls = [];
        const { status, body, calls } = await call({
            userId: CALLER_ID,
            body: { public_id: `unilink/users/${SPOOFED_ID}/stolen-photo` },
            updateCalls,
        }, 'confirm');
        strict_1.default.equal(status, 400);
        strict_1.default.deepEqual(body, { error: 'public_id must be within your own upload folder' });
        strict_1.default.equal(calls.length, 0, 'updateOwnProfile must not be called on a prefix mismatch');
        strict_1.default.equal(updateCalls.length, 0, 'nothing may be persisted for a foreign public_id');
    });
    (0, node_test_1.it)('400 and never stores for a SIBLING-prefix folder (trailing-slash check)', async () => {
        const updateCalls = [];
        // `unilink/users/{CALLER_ID}-evil/...` startsWith `unilink/users/{CALLER_ID}`
        // but is NOT inside the caller's folder — the trailing slash must catch it.
        const { status, calls } = await call({
            userId: CALLER_ID,
            body: { public_id: `unilink/users/${CALLER_ID}-evil/attack.png` },
            updateCalls,
        }, 'confirm');
        strict_1.default.equal(status, 400);
        strict_1.default.equal(calls.length, 0, 'sibling folders must never pass the ownership gate');
        strict_1.default.equal(updateCalls.length, 0);
    });
    (0, node_test_1.it)('400 and never stores for a public_id equal to the bare folder (no trailing /)', async () => {
        const updateCalls = [];
        const { status, calls } = await call({ userId: CALLER_ID, body: { public_id: `unilink/users/${CALLER_ID}` }, updateCalls }, 'confirm');
        strict_1.default.equal(status, 400);
        strict_1.default.equal(calls.length, 0, 'the folder itself is not an asset public_id');
        strict_1.default.equal(updateCalls.length, 0);
    });
    (0, node_test_1.it)('400 for a missing public_id', async () => {
        const { status, calls } = await call({ userId: CALLER_ID, body: {} }, 'confirm');
        strict_1.default.equal(status, 400);
        strict_1.default.equal(calls.length, 0);
    });
    (0, node_test_1.it)('400 for a non-string public_id', async () => {
        const { status, calls } = await call({ userId: CALLER_ID, body: { public_id: 42 } }, 'confirm');
        strict_1.default.equal(status, 400);
        strict_1.default.equal(calls.length, 0);
    });
    (0, node_test_1.it)('400 for a public_id that is empty after trimming', async () => {
        const { status, calls } = await call({ userId: CALLER_ID, body: { public_id: '   ' } }, 'confirm');
        strict_1.default.equal(status, 400);
        strict_1.default.equal(calls.length, 0);
    });
    (0, node_test_1.it)('400 for an over-length public_id (>255 chars)', async () => {
        const tooLong = `unilink/users/${CALLER_ID}/${'x'.repeat(300)}`;
        const { status, calls } = await call({ userId: CALLER_ID, body: { public_id: tooLong } }, 'confirm');
        strict_1.default.equal(status, 400);
        strict_1.default.equal(calls.length, 0);
    });
    (0, node_test_1.it)('trims surrounding whitespace and stores the trimmed public_id', async () => {
        const publicId = `unilink/users/${CALLER_ID}/avatar.png`;
        const { status, body } = await call({ userId: CALLER_ID, body: { public_id: `  ${publicId}  ` } }, 'confirm');
        strict_1.default.equal(status, 200);
        strict_1.default.deepEqual(body, { ok: true, photo_public_id: publicId });
    });
    (0, node_test_1.it)('401 when req.userId is missing and nothing is stored', async () => {
        const { status, calls } = await call({ body: { public_id: `unilink/users/${SPOOFED_ID}/img.png` } }, 'confirm');
        strict_1.default.equal(status, 401);
        strict_1.default.equal(calls.length, 0);
    });
    (0, node_test_1.it)('404 when the caller row does not exist (rowCount 0)', async () => {
        const { status, body } = await call({
            userId: CALLER_ID,
            body: { public_id: `unilink/users/${CALLER_ID}/avatar.png` },
            updateResult: { rowCount: 0 },
        }, 'confirm');
        strict_1.default.equal(status, 404);
        strict_1.default.deepEqual(body, { error: 'User not found' });
    });
    (0, node_test_1.it)('500 when the update store throws', async () => {
        const { status, body } = await call({
            userId: CALLER_ID,
            body: { public_id: `unilink/users/${CALLER_ID}/avatar.png` },
            updateThrows: true,
        }, 'confirm');
        strict_1.default.equal(status, 500);
        strict_1.default.deepEqual(body, { error: 'Failed to confirm photo upload' });
    });
});
(0, node_test_1.describe)('GET /photo/photo-url', () => {
    const PHOTO_ID = `unilink/users/${CALLER_ID}/avatar.png`;
    function ownPhotoProfile() {
        return {
            id: CALLER_ID,
            nickname: 'Caller',
            gender: null,
            photo_public_id: PHOTO_ID,
            custom_interest_text: null,
            created_at: new Date(0),
        };
    }
    (0, node_test_1.it)('200 UNBLURRED signed url for a MATCHED pair; matcher called with (caller, target)', async () => {
        const matchCalls = [];
        const urlBuilderCalls = [];
        const { status, body, calls } = await call({
            userId: CALLER_ID,
            query: { target: OTHER },
            matchResult: true,
            profile: ownPhotoProfile(),
            matchCalls,
            urlBuilderCalls,
        }, 'photo-url');
        strict_1.default.equal(status, 200);
        strict_1.default.equal(body.blurred, false);
        strict_1.default.ok(body.url.includes('/s--'), 'unblurred URL must still be SIGNED');
        strict_1.default.ok(!body.url.includes('e_blur'), 'matched branch must have no blur transform');
        strict_1.default.deepEqual(calls[0].args, [CALLER_ID, OTHER]);
        strict_1.default.deepEqual(calls[1].args, [OTHER]);
        strict_1.default.deepEqual(calls[2].args, [PHOTO_ID, { blurred: false }]);
        strict_1.default.deepEqual(matchCalls, [[CALLER_ID, OTHER]]);
        strict_1.default.deepEqual(urlBuilderCalls, [{ publicId: PHOTO_ID, blurred: false }]);
    });
    (0, node_test_1.it)('200 BLURRED signed url (e_blur:2000) when NOT matched', async () => {
        const urlBuilderCalls = [];
        const { status, body, calls } = await call({
            userId: CALLER_ID,
            query: { target: OTHER },
            matchResult: false,
            profile: ownPhotoProfile(),
            urlBuilderCalls,
        }, 'photo-url');
        strict_1.default.equal(status, 200);
        strict_1.default.equal(body.blurred, true);
        strict_1.default.ok(body.url.includes('e_blur:2000'), 'non-matched branch must carry the blur transform');
        strict_1.default.ok(body.url.includes('/s--'), 'blurred URL must STILL be SIGNED (never unsigned)');
        strict_1.default.deepEqual(calls[2].args, [PHOTO_ID, { blurred: true }]);
        strict_1.default.deepEqual(urlBuilderCalls, [{ publicId: PHOTO_ID, blurred: true }]);
    });
    (0, node_test_1.it)('REJECTION: a non-matched pair forcing unblurred variants still gets the blurred url', async () => {
        // The client tries every query-param trick to opt out of the blur; the
        // branch must be driven solely by matchExistsBetween's result.
        for (const forced of [
            { blurred: 'false' },
            { unblur: '1' },
            { matched: '1' },
            { match: 'true' },
            { blurred: 'false', unblur: '1', matched: '1' },
        ]) {
            const { status, body } = await call({
                userId: CALLER_ID,
                query: { target: OTHER, ...forced },
                matchResult: false,
                profile: ownPhotoProfile(),
            }, 'photo-url');
            strict_1.default.equal(status, 200, `variant ${JSON.stringify(forced)}`);
            strict_1.default.equal(body.blurred, true, `variant ${JSON.stringify(forced)}`);
            strict_1.default.ok(body.url.includes('e_blur:2000'), `forced variant ${JSON.stringify(forced)} must NOT unblur`);
        }
    });
    (0, node_test_1.it)('matcher is re-evaluated on EVERY request (no caching) between two calls', async () => {
        const matchCalls = [];
        const first = await call({ userId: CALLER_ID, query: { target: OTHER }, matchResult: false, profile: ownPhotoProfile(), matchCalls }, 'photo-url');
        // A match is made in between the two requests.
        const second = await call({ userId: CALLER_ID, query: { target: OTHER }, matchResult: true, profile: ownPhotoProfile(), matchCalls }, 'photo-url');
        strict_1.default.equal(first.body.blurred, true);
        strict_1.default.equal(second.body.blurred, false, 'second request must see the NEW match state');
        strict_1.default.equal(matchCalls.length, 2, 'matcher must run once per request, not be cached');
    });
    (0, node_test_1.it)('401 without req.userId and the matcher is not called', async () => {
        const { status, calls } = await call({ query: { target: OTHER } }, 'photo-url');
        strict_1.default.equal(status, 401);
        strict_1.default.equal(calls.length, 0);
    });
    (0, node_test_1.it)('400 for a missing / empty target', async () => {
        for (const query of [{}, { target: '' }, { target: '   ' }]) {
            const { status, calls } = await call({ userId: CALLER_ID, query }, 'photo-url');
            strict_1.default.equal(status, 400, JSON.stringify(query));
            strict_1.default.equal(calls.length, 0, `no deps may run for ${JSON.stringify(query)}`);
        }
    });
    (0, node_test_1.it)('400 for a malformed (non-UUID) target', async () => {
        for (const bad of ['not-a-uuid', `${OTHER}x`, OTHER.slice(0, 35)]) {
            const { status, calls } = await call({ userId: CALLER_ID, query: { target: bad } }, 'photo-url');
            strict_1.default.equal(status, 400, bad);
            strict_1.default.equal(calls.length, 0, `malformed target "${bad}" must not reach the matcher`);
        }
    });
    (0, node_test_1.it)('404 when the target user does not exist', async () => {
        const { status, body, calls } = await call({ userId: CALLER_ID, query: { target: OTHER }, matchResult: true, profile: null }, 'photo-url');
        strict_1.default.equal(status, 404);
        strict_1.default.deepEqual(body, { error: 'User not found' });
        strict_1.default.ok(calls.some((c) => c.name === 'matchExistsBetween'), 'matcher still ran');
        strict_1.default.ok(!calls.some((c) => c.name === 'buildPhotoUrl'), 'no URL built for a missing user');
    });
    (0, node_test_1.it)('404 when the target user has no photo', async () => {
        const { status, body, calls } = await call({
            userId: CALLER_ID,
            query: { target: OTHER },
            matchResult: true,
            profile: { ...ownPhotoProfile(), id: OTHER, photo_public_id: null },
        }, 'photo-url');
        strict_1.default.equal(status, 404);
        strict_1.default.deepEqual(body, { error: 'User has no photo' });
        strict_1.default.ok(!calls.some((c) => c.name === 'buildPhotoUrl'), 'no URL built without a photo');
    });
    (0, node_test_1.it)('500 when the matcher throws', async () => {
        const { status, body } = await call({ userId: CALLER_ID, query: { target: OTHER }, matchThrows: true }, 'photo-url');
        strict_1.default.equal(status, 500);
        strict_1.default.deepEqual(body, { error: 'Failed to build photo url' });
    });
    (0, node_test_1.it)('500 when the url builder throws (e.g. unconfigured Cloudinary)', async () => {
        const { status, body } = await call({
            userId: CALLER_ID,
            query: { target: OTHER },
            matchResult: true,
            profile: ownPhotoProfile(),
            urlBuilderThrows: true,
        }, 'photo-url');
        strict_1.default.equal(status, 500);
        strict_1.default.deepEqual(body, { error: 'Failed to build photo url' });
    });
});
//# sourceMappingURL=photo.test.js.map