import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { afterEach, describe, it } from 'node:test';
import {
  PHOTO_BLUR_TRANSFORMATION,
  PHOTO_ROOT_FOLDER,
  buildPhotoUrl,
  createUploadSignature,
  userFolder,
} from './cloudinary';

const CLOUD_NAME = 'test-cloud';
const API_KEY = 'test-key';
const API_SECRET = 'test-secret';

function setEnv(): void {
  process.env.CLOUDINARY_CLOUD_NAME = CLOUD_NAME;
  process.env.CLOUDINARY_API_KEY = API_KEY;
  process.env.CLOUDINARY_API_SECRET = API_SECRET;
}

function clearEnv(): void {
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
function expectedSignature(params: Record<string, unknown>, secret: string): string {
  const toSign = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('&');
  return createHash('sha1').update(toSign + secret).digest('hex');
}

afterEach(clearEnv);

describe('userFolder', () => {
  it('scopes the folder to unilink/users/{userId} under a fixed root', () => {
    const id = 'c074b9cb-48f0-4900-9040-2718ad82ce55';
    assert.equal(userFolder(id), `${PHOTO_ROOT_FOLDER}/${id}`);
    assert.equal(userFolder(id), `unilink/users/${id}`);
  });
});

describe('createUploadSignature', () => {
  it('returns exactly { signature, timestamp, api_key, cloud_name, folder }', () => {
    setEnv();
    const folder = userFolder('user-1');
    const payload = createUploadSignature(folder, 1_700_000_000);

    assert.deepEqual(Object.keys(payload).sort(), [
      'api_key',
      'cloud_name',
      'folder',
      'signature',
      'timestamp',
    ]);
  });

  it('echoes the injected timestamp and returns the folder unchanged', () => {
    setEnv();
    const folder = userFolder('user-1');
    const payload = createUploadSignature(folder, 1_700_000_000);

    assert.equal(payload.timestamp, 1_700_000_000);
    assert.equal(payload.folder, folder);
  });

  it('takes api_key and cloud_name from the environment', () => {
    setEnv();
    const payload = createUploadSignature(userFolder('user-1'), 1_700_000_000);

    assert.equal(payload.api_key, API_KEY);
    assert.equal(payload.cloud_name, CLOUD_NAME);
  });

  it('signature matches an independent SHA-1 of folder+timestamp+secret', () => {
    setEnv();
    const folder = userFolder('user-1');
    const timestamp = 1_700_000_000;
    const payload = createUploadSignature(folder, timestamp);

    assert.equal(
      payload.signature,
      expectedSignature({ folder, timestamp }, API_SECRET),
    );
  });

  it('binds the signature to folder and timestamp (scope cannot be reused)', () => {
    setEnv();
    const a = createUploadSignature(userFolder('user-1'), 1_700_000_000);
    const b = createUploadSignature(userFolder('user-2'), 1_700_000_000);
    const c = createUploadSignature(userFolder('user-1'), 1_700_000_001);

    assert.notEqual(a.signature, b.signature, 'a different folder must change the signature');
    assert.notEqual(a.signature, c.signature, 'a different timestamp must change the signature');
  });

  it('does not sign any other parameters (only folder + timestamp)', () => {
    setEnv();
    const folder = userFolder('user-1');
    const payload = createUploadSignature(folder, 1_700_000_000);

    // If any extra param were signed, the 2-param hash would not match.
    assert.equal(payload.signature, expectedSignature({ folder, timestamp: 1_700_000_000 }, API_SECRET));
  });

  it('throws, naming every missing env var, when Cloudinary is not configured', () => {
    clearEnv();
    assert.throws(
      () => createUploadSignature(userFolder('user-1'), 1_700_000_000),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /CLOUDINARY_CLOUD_NAME/);
        assert.match(err.message, /CLOUDINARY_API_KEY/);
        assert.match(err.message, /CLOUDINARY_API_SECRET/);
        return true;
      },
    );
  });

  it('throws when only the api_secret is missing', () => {
    setEnv();
    delete process.env.CLOUDINARY_API_SECRET;
    assert.throws(
      () => createUploadSignature(userFolder('user-1'), 1_700_000_000),
      /CLOUDINARY_API_SECRET/,
    );
  });
});


describe('buildPhotoUrl', () => {
  const PUBLIC_ID = 'unilink/users/c074b9cb-48f0-4900-9040-2718ad82ce55/avatar.png';

  it('blur transform constant is blur:2000 (renders as e_blur:2000)', () => {
    assert.deepEqual(PHOTO_BLUR_TRANSFORMATION, [{ effect: 'blur:2000' }]);
  });

  it('UNBLURRED url is SIGNED (carries the s--...-- signature segment)', () => {
    setEnv();
    const url = buildPhotoUrl(PUBLIC_ID);

    assert.ok(url.startsWith('https://res.cloudinary.com/'), url);
    assert.ok(url.includes(PUBLIC_ID), url);
    assert.match(url, /\/s--[A-Za-z0-9_-]{8}--\//, 'unblurred URL must contain the signature segment');
    assert.ok(!url.includes('e_blur'), 'unblurred URL must not contain the blur transform');
  });

  it('BLURRED url carries e_blur:2000 AND is still SIGNED (never unsigned either branch)', () => {
    setEnv();
    const url = buildPhotoUrl(PUBLIC_ID, { blurred: true });

    assert.ok(url.includes('e_blur:2000'), `blurred URL must contain the blur transform: ${url}`);
    assert.match(url, /\/s--[A-Za-z0-9_-]{8}--\//, 'blurred URL must STILL contain the signature segment');
    assert.ok(url.startsWith('https://res.cloudinary.com/'), url);
  });

  it('the signature differs between blurred and unblurred (transform is covered by the signature)', () => {
    setEnv();
    const unblurred = buildPhotoUrl(PUBLIC_ID);
    const blurred = buildPhotoUrl(PUBLIC_ID, { blurred: true });

    const sig = (u: string) => u.match(/\/s--([A-Za-z0-9_-]{8})--\//)?.[1];
    assert.ok(sig(unblurred) && sig(blurred));
    assert.notEqual(sig(unblurred), sig(blurred), 'a viewer must not be able to swap transforms onto a signed URL');
  });

  it('throws when Cloudinary is not configured (both branches)', () => {
    clearEnv();
    assert.throws(() => buildPhotoUrl(PUBLIC_ID), /CLOUDINARY_CLOUD_NAME/);
    assert.throws(() => buildPhotoUrl(PUBLIC_ID, { blurred: true }), /CLOUDINARY_CLOUD_NAME/);
  });
});