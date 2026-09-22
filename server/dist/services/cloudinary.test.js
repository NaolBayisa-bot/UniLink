"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_crypto_1 = require("node:crypto");
const node_test_1 = require("node:test");
const cloudinary_1 = require("./cloudinary");
const CLOUD_NAME = 'test-cloud';
const API_KEY = 'test-key';
const API_SECRET = 'test-secret';
function setEnv() {
    process.env.CLOUDINARY_CLOUD_NAME = CLOUD_NAME;
    process.env.CLOUDINARY_API_KEY = API_KEY;
    process.env.CLOUDINARY_API_SECRET = API_SECRET;
}
function clearEnv() {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
}
/**
 * Independently recompute the expected Cloudinary signature (SHA-1 of the
 * sorted, blank-filtered params joined by '&', with the api_secret appended).
 * Deliberately NOT using the SDK here, so the test proves the output rather
 * than re-asserting the library against itself.
 */
function expectedSignature(params, secret) {
    const toSign = Object.entries(params)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k}=${v}`)
        .sort()
        .join('&');
    return (0, node_crypto_1.createHash)('sha1').update(toSign + secret).digest('hex');
}
(0, node_test_1.afterEach)(clearEnv);
(0, node_test_1.describe)('userFolder', () => {
    (0, node_test_1.it)('scopes the folder to unilink/users/{userId} under a fixed root', () => {
        const id = 'c074b9cb-48f0-4900-9040-2718ad82ce55';
        strict_1.default.equal((0, cloudinary_1.userFolder)(id), `${cloudinary_1.PHOTO_ROOT_FOLDER}/${id}`);
        strict_1.default.equal((0, cloudinary_1.userFolder)(id), `unilink/users/${id}`);
    });
});
(0, node_test_1.describe)('createUploadSignature', () => {
    (0, node_test_1.it)('returns exactly { signature, timestamp, api_key, cloud_name, folder }', () => {
        setEnv();
        const folder = (0, cloudinary_1.userFolder)('user-1');
        const payload = (0, cloudinary_1.createUploadSignature)(folder, 1700000000);
        strict_1.default.deepEqual(Object.keys(payload).sort(), [
            'api_key',
            'cloud_name',
            'folder',
            'signature',
            'timestamp',
        ]);
    });
    (0, node_test_1.it)('echoes the injected timestamp and returns the folder unchanged', () => {
        setEnv();
        const folder = (0, cloudinary_1.userFolder)('user-1');
        const payload = (0, cloudinary_1.createUploadSignature)(folder, 1700000000);
        strict_1.default.equal(payload.timestamp, 1700000000);
        strict_1.default.equal(payload.folder, folder);
    });
    (0, node_test_1.it)('takes api_key and cloud_name from the environment', () => {
        setEnv();
        const payload = (0, cloudinary_1.createUploadSignature)((0, cloudinary_1.userFolder)('user-1'), 1700000000);
        strict_1.default.equal(payload.api_key, API_KEY);
        strict_1.default.equal(payload.cloud_name, CLOUD_NAME);
    });
    (0, node_test_1.it)('signature matches an independent SHA-1 of folder+timestamp+secret', () => {
        setEnv();
        const folder = (0, cloudinary_1.userFolder)('user-1');
        const timestamp = 1700000000;
        const payload = (0, cloudinary_1.createUploadSignature)(folder, timestamp);
        strict_1.default.equal(payload.signature, expectedSignature({ folder, timestamp }, API_SECRET));
    });
    (0, node_test_1.it)('binds the signature to folder and timestamp (scope cannot be reused)', () => {
        setEnv();
        const a = (0, cloudinary_1.createUploadSignature)((0, cloudinary_1.userFolder)('user-1'), 1700000000);
        const b = (0, cloudinary_1.createUploadSignature)((0, cloudinary_1.userFolder)('user-2'), 1700000000);
        const c = (0, cloudinary_1.createUploadSignature)((0, cloudinary_1.userFolder)('user-1'), 1700000001);
        strict_1.default.notEqual(a.signature, b.signature, 'a different folder must change the signature');
        strict_1.default.notEqual(a.signature, c.signature, 'a different timestamp must change the signature');
    });
    (0, node_test_1.it)('does not sign any other parameters (only folder + timestamp)', () => {
        setEnv();
        const folder = (0, cloudinary_1.userFolder)('user-1');
        const payload = (0, cloudinary_1.createUploadSignature)(folder, 1700000000);
        // If any extra param were signed, the 2-param hash would not match.
        strict_1.default.equal(payload.signature, expectedSignature({ folder, timestamp: 1700000000 }, API_SECRET));
    });
    (0, node_test_1.it)('throws, naming every missing env var, when Cloudinary is not configured', () => {
        clearEnv();
        strict_1.default.throws(() => (0, cloudinary_1.createUploadSignature)((0, cloudinary_1.userFolder)('user-1'), 1700000000), (err) => {
            strict_1.default.ok(err instanceof Error);
            strict_1.default.match(err.message, /CLOUDINARY_CLOUD_NAME/);
            strict_1.default.match(err.message, /CLOUDINARY_API_KEY/);
            strict_1.default.match(err.message, /CLOUDINARY_API_SECRET/);
            return true;
        });
    });
    (0, node_test_1.it)('throws when only the api_secret is missing', () => {
        setEnv();
        delete process.env.CLOUDINARY_API_SECRET;
        strict_1.default.throws(() => (0, cloudinary_1.createUploadSignature)((0, cloudinary_1.userFolder)('user-1'), 1700000000), /CLOUDINARY_API_SECRET/);
    });
});
(0, node_test_1.describe)('buildPhotoUrl', () => {
    const PUBLIC_ID = 'unilink/users/c074b9cb-48f0-4900-9040-2718ad82ce55/avatar.png';
    (0, node_test_1.it)('blur transform constant is blur:2000 (renders as e_blur:2000)', () => {
        strict_1.default.deepEqual(cloudinary_1.PHOTO_BLUR_TRANSFORMATION, [{ effect: 'blur:2000' }]);
    });
    (0, node_test_1.it)('UNBLURRED url is SIGNED (carries the s--...-- signature segment)', () => {
        setEnv();
        const url = (0, cloudinary_1.buildPhotoUrl)(PUBLIC_ID);
        strict_1.default.ok(url.startsWith('https://res.cloudinary.com/'), url);
        strict_1.default.ok(url.includes(PUBLIC_ID), url);
        strict_1.default.match(url, /\/s--[A-Za-z0-9_-]{8}--\//, 'unblurred URL must contain the signature segment');
        strict_1.default.ok(!url.includes('e_blur'), 'unblurred URL must not contain the blur transform');
    });
    (0, node_test_1.it)('BLURRED url carries e_blur:2000 AND is still SIGNED (never unsigned either branch)', () => {
        setEnv();
        const url = (0, cloudinary_1.buildPhotoUrl)(PUBLIC_ID, { blurred: true });
        strict_1.default.ok(url.includes('e_blur:2000'), `blurred URL must contain the blur transform: ${url}`);
        strict_1.default.match(url, /\/s--[A-Za-z0-9_-]{8}--\//, 'blurred URL must STILL contain the signature segment');
        strict_1.default.ok(url.startsWith('https://res.cloudinary.com/'), url);
    });
    (0, node_test_1.it)('the signature differs between blurred and unblurred (transform is covered by the signature)', () => {
        setEnv();
        const unblurred = (0, cloudinary_1.buildPhotoUrl)(PUBLIC_ID);
        const blurred = (0, cloudinary_1.buildPhotoUrl)(PUBLIC_ID, { blurred: true });
        const sig = (u) => u.match(/\/s--([A-Za-z0-9_-]{8})--\//)?.[1];
        strict_1.default.ok(sig(unblurred) && sig(blurred));
        strict_1.default.notEqual(sig(unblurred), sig(blurred), 'a viewer must not be able to swap transforms onto a signed URL');
    });
    (0, node_test_1.it)('throws when Cloudinary is not configured (both branches)', () => {
        clearEnv();
        strict_1.default.throws(() => (0, cloudinary_1.buildPhotoUrl)(PUBLIC_ID), /CLOUDINARY_CLOUD_NAME/);
        strict_1.default.throws(() => (0, cloudinary_1.buildPhotoUrl)(PUBLIC_ID, { blurred: true }), /CLOUDINARY_CLOUD_NAME/);
    });
});
//# sourceMappingURL=cloudinary.test.js.map