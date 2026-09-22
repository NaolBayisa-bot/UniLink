"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.USER_B = exports.USER_A = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const authorization_1 = require("./authorization");
// The two seeded test users from Task 20.
const USER_A = 'c074b9cb-48f0-4900-9040-2718ad82ce55';
exports.USER_A = USER_A;
const USER_B = 'b6084c09-cfed-4294-811a-7c3fbc1c1d9a';
exports.USER_B = USER_B;
/** Build a fake QueryResult with the given rows. */
function result(rows = []) {
    return {
        rows,
        command: 'SELECT',
        rowCount: rows.length,
        oid: 0,
        fields: [],
    };
}
const req = (userId) => ({ userId });
(0, node_test_1.describe)('assertIsSelf', () => {
    (0, node_test_1.it)('passes when req.userId matches targetId', () => {
        strict_1.default.doesNotThrow(() => (0, authorization_1.assertIsSelf)(req(USER_A), USER_A));
    });
    (0, node_test_1.it)('throws 403 when req.userId is missing', () => {
        strict_1.default.throws(() => (0, authorization_1.assertIsSelf)(req(undefined), USER_A), (err) => {
            strict_1.default.ok(err instanceof authorization_1.HttpError);
            strict_1.default.equal(err.status, 403);
            return true;
        });
    });
    (0, node_test_1.it)('throws 403 when req.userId differs from targetId', () => {
        strict_1.default.throws(() => (0, authorization_1.assertIsSelf)(req(USER_A), USER_B), (err) => {
            strict_1.default.ok(err instanceof authorization_1.HttpError);
            strict_1.default.equal(err.status, 403);
            strict_1.default.match(err.message, /not authorized/i);
            return true;
        });
    });
});
(0, node_test_1.describe)('matchExistsBetween', () => {
    (0, node_test_1.it)('returns true when an active row exists (A,B)', async () => {
        const q = async (text) => {
            strict_1.default.match(text, /unmatched_at IS NULL/i);
            return result([{ id: 'm1' }]);
        };
        strict_1.default.equal(await (0, authorization_1.matchExistsBetween)(USER_A, USER_B, q), true);
    });
    (0, node_test_1.it)('returns true regardless of user order (B,A)', async () => {
        const q = async (text, params) => {
            strict_1.default.deepEqual(params, [USER_B, USER_A]);
            return result([{ id: 'm1' }]);
        };
        strict_1.default.equal(await (0, authorization_1.matchExistsBetween)(USER_B, USER_A, q), true);
    });
    (0, node_test_1.it)('returns false when no row exists', async () => {
        const q = async () => result([]);
        strict_1.default.equal(await (0, authorization_1.matchExistsBetween)(USER_A, USER_B, q), false);
    });
});
(0, node_test_1.describe)('isBlockedPair', () => {
    (0, node_test_1.it)('returns true when A blocked B', async () => {
        const q = async () => result([{ zero: '0' }]);
        strict_1.default.equal(await (0, authorization_1.isBlockedPair)(USER_A, USER_B, q), true);
    });
    (0, node_test_1.it)('returns true when B blocked A (either direction', async () => {
        const q = async (text, params) => {
            strict_1.default.match(text, /blocker_id|blocked_id/i);
            strict_1.default.deepEqual(params, [USER_A, USER_B]);
            return result([{ zero: '0' }]);
        };
        strict_1.default.equal(await (0, authorization_1.isBlockedPair)(USER_A, USER_B, q), true);
    });
    (0, node_test_1.it)('returns false when there is no block', async () => {
        const q = async () => result([]);
        strict_1.default.equal(await (0, authorization_1.isBlockedPair)(USER_A, USER_B, q), false);
    });
});
(0, node_test_1.describe)('blockedPairPredicate (shared with the browse filter)', () => {
    (0, node_test_1.it)('renders a check in BOTH directions', () => {
        const sql = (0, authorization_1.blockedPairPredicate)('$1::uuid', '$2::uuid');
        strict_1.default.match(sql, /blocker_id\s*=\s*\$1::uuid\s+AND\s+blocked_id\s*=\s*\$2::uuid/i);
        strict_1.default.match(sql, /blocker_id\s*=\s*\$2::uuid\s+AND\s+blocked_id\s*=\s*\$1::uuid/i);
    });
    (0, node_test_1.it)('accepts a column expression, for correlating candidate rows in browse', () => {
        const sql = (0, authorization_1.blockedPairPredicate)('$1::uuid', 'users.id');
        strict_1.default.match(sql, /blocker_id\s*=\s*\$1::uuid\s+AND\s+blocked_id\s*=\s*users\.id/i);
        strict_1.default.match(sql, /blocker_id\s*=\s*users\.id\s+AND\s+blocked_id\s*=\s*\$1::uuid/i);
    });
});
(0, node_test_1.describe)('hasOpenReportAgainst', () => {
    (0, node_test_1.it)('returns true when an open report exists', async () => {
        const q = async (text, params) => {
            strict_1.default.match(text, /status = 'open'/i);
            strict_1.default.equal(params?.[0], USER_A);
            return result([{ zero: '0' }]);
        };
        strict_1.default.equal(await (0, authorization_1.hasOpenReportAgainst)(USER_A, q), true);
    });
    (0, node_test_1.it)('returns false when only resolved reports exist', async () => {
        const q = async () => result([]);
        strict_1.default.equal(await (0, authorization_1.hasOpenReportAgainst)(USER_A, q), false);
    });
    (0, node_test_1.it)('returns false when there are no reports', async () => {
        const q = async () => result([]);
        strict_1.default.equal(await (0, authorization_1.hasOpenReportAgainst)(USER_A, q), false);
    });
});
(0, node_test_1.describe)('openReportAgainstPredicate (shared with the browse filter)', () => {
    (0, node_test_1.it)("renders an OPEN-only check against the given expression", () => {
        const sql = (0, authorization_1.openReportAgainstPredicate)('$1::uuid');
        strict_1.default.match(sql, /reported_id\s*=\s*\$1::uuid/i);
        strict_1.default.match(sql, /status\s*=\s*'open'/i);
        strict_1.default.ok(!/resolved/i.test(sql), 'resolved reports must never match');
    });
    (0, node_test_1.it)('accepts a column expression, for correlating candidate rows in browse', () => {
        const sql = (0, authorization_1.openReportAgainstPredicate)('users.id');
        strict_1.default.match(sql, /reported_id\s*=\s*users\.id\s+AND\s+status\s*=\s*'open'/i);
    });
});
// Read-only integration checks against the real (Task-20 seeded) database.
// These never write; they only confirm the live helpers agree with the seeded
// test fixtures (UserA <-> UserB share one active match; no blocks/reports).
(0, node_test_1.describe)('integration (live DB, read-only)', () => {
    (0, node_test_1.describe)('matchExistsBetween on seeded pair', () => {
        (0, node_test_1.it)('detects the active A<->B match', async () => {
            strict_1.default.equal(await (0, authorization_1.matchExistsBetween)(USER_A, USER_B), true);
        });
        (0, node_test_1.it)('is order-agnostic (B,A)', async () => {
            strict_1.default.equal(await (0, authorization_1.matchExistsBetween)(USER_B, USER_A), true);
        });
    });
    (0, node_test_1.describe)('no blocks / reports currently seeded', () => {
        (0, node_test_1.it)('reports the seeded pair as not blocked', async () => {
            strict_1.default.equal(await (0, authorization_1.isBlockedPair)(USER_A, USER_B), false);
        });
        (0, node_test_1.it)('reports no open report against UserA', async () => {
            strict_1.default.equal(await (0, authorization_1.hasOpenReportAgainst)(USER_A), false);
        });
    });
});
//# sourceMappingURL=authorization.test.js.map