"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const cloudinary_1 = __importDefault(require("cloudinary"));
async function checkCloudinary() {
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
        console.error(`❌ Missing in .env: ${missing.join(', ')}`);
        process.exit(1);
    }
    cloudinary_1.default.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
    });
    try {
        const ping = await cloudinary_1.default.api.ping();
        console.log(`✅ Cloudinary ping ok — status: ${ping.status} (cloud: ${cloudName})`);
        const usage = await cloudinary_1.default.api.usage();
        console.log(`   Plan: ${usage.plan}`);
        console.log(`   Credits: ${usage.credits_usage?.credits_usage ?? 'n/a'} / ${usage.credits_usage?.credits_limit ?? 'n/a'} used`);
    }
    catch (error) {
        console.error('❌ Cloudinary connection failed:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}
checkCloudinary();
//# sourceMappingURL=check-cloudinary.js.map