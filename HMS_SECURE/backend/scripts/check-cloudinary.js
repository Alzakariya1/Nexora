require('dotenv').config();

const { cloudinary, hasCloudinaryConfig, cleanEnv } = require('../src/config/cloudinary');

(async () => {
  const configured = hasCloudinaryConfig();
  console.log('Cloudinary configured:', configured);
  console.log('Cloud name:', cleanEnv(process.env.CLOUDINARY_CLOUD_NAME) || '(missing)');

  if (!configured) {
    console.log('Missing or placeholder Cloudinary env vars.');
    console.log('Add real CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in Render backend Environment.');
    process.exit(1);
  }

  const ping = await cloudinary.api.ping();
  console.log('Cloudinary ping:', ping);
})().catch((err) => {
  console.error('Cloudinary check failed:', err.message);
  process.exit(1);
});
