import 'dotenv/config';
import cloudinary from 'cloudinary';

type UsageResult = {
  plan: string;
  credits_usage?: {
    credits: number;
    credits_usage?: number;
    credits_limit?: number;
    usage_percentage?: number;
  };
};

async function checkCloudinary(): Promise<void> {
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

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  try {
    const ping = await cloudinary.api.ping();
    console.log(`✅ Cloudinary ping ok — status: ${ping.status} (cloud: ${cloudName})`);

    const usage: UsageResult = await cloudinary.api.usage();
    console.log(`   Plan: ${usage.plan}`);
    console.log(
      `   Credits: ${usage.credits_usage?.credits_usage ?? 'n/a'} / ${usage.credits_usage?.credits_limit ?? 'n/a'} used`,
    );
  } catch (error) {
    console.error(
      '❌ Cloudinary connection failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

checkCloudinary();