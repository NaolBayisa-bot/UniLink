"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const query_1 = require("./db/query");
const auth_1 = require("./routes/auth");
const profile_1 = require("./routes/profile");
const photo_1 = require("./routes/photo");
const browse_1 = require("./routes/browse");
const jwt_auth_1 = __importDefault(require("./middleware/jwt-auth"));
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/health', async (_req, res) => {
    try {
        const { rows } = await (0, query_1.query)('SELECT now() AS db_time');
        res.json({ status: 'ok', db_time: rows[0].db_time });
    }
    catch {
        res.status(503).json({ status: 'error', message: 'Database unavailable' });
    }
});
// POST /auth/complete-signup — auth completion flow (Telegram + Google).
app.use('/auth', auth_1.authRouter);
// POST /profile — the authenticated caller updates their own profile. Protected
// by jwtAuth, which sets req.userId (the single source of truth for identity).
app.use('/profile', jwt_auth_1.default, profile_1.profileRouter);
// POST /photo/upload-signature — signed Cloudinary direct-upload params scoped
// to the authenticated caller's own folder. Protected by jwtAuth (req.userId is
// the single source of truth for identity).
app.use('/photo', jwt_auth_1.default, photo_1.photoRouter);
// GET /browse — active users whose gender differs from the caller's. Both the
// caller's identity and their gender come from req.userId (the single source of
// truth for identity); request bodies/queries are never consulted.
app.use('/browse', jwt_auth_1.default, browse_1.browseRouter);
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
//# sourceMappingURL=index.js.map