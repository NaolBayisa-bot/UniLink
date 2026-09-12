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
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
//# sourceMappingURL=index.js.map