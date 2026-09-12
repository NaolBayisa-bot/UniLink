"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = query;
const pool_1 = require("./pool");
async function query(text, params) {
    try {
        return await pool_1.pool.query(text, params);
    }
    catch (error) {
        console.error('Database query error:', { text, params, error });
        throw error;
    }
}
//# sourceMappingURL=query.js.map