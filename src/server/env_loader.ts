import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('✅ Environment loaded from .env.local');
} else {
  dotenv.config();
  console.log('ℹ️ .env.local not found, using default .env');
}

// Ensure critical variables are also set in process.env for libs that check it at load time
if (process.env.FIREBASE_PROJECT_ID && !process.env.GOOGLE_CLOUD_PROJECT) {
    process.env.GOOGLE_CLOUD_PROJECT = process.env.FIREBASE_PROJECT_ID;
}
if (process.env.GOOGLE_CLOUD_PROJECT && !process.env.GCLOUD_PROJECT) {
    process.env.GCLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
}
