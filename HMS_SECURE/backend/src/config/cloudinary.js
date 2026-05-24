const cloudinary = require("cloudinary").v2;

function cleanCloudinaryValue(value = "") {
  return String(value || "").trim().replace(/^['\"]|['\"]$/g, "").replace(/^<|>$/g, "");
}

function isPlaceholder(value = "") {
  const v = cleanCloudinaryValue(value).toLowerCase();
  return !v || v.includes("your_actual") || v === "root" || v === "cloud_name" || v === "api_key" || v === "api_secret";
}

function getCloudinaryConfig() {
  const cloudName = cleanCloudinaryValue(process.env.CLOUDINARY_CLOUD_NAME);
  const apiKey = cleanCloudinaryValue(process.env.CLOUDINARY_API_KEY);
  const apiSecret = cleanCloudinaryValue(process.env.CLOUDINARY_API_SECRET);

  if (process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_CLOUD_NAME) {
    return { cloudinaryUrl: cleanCloudinaryValue(process.env.CLOUDINARY_URL) };
  }

  return { cloudName, apiKey, apiSecret };
}

function hasCloudinaryConfig() {
  const cfg = getCloudinaryConfig();
  if (cfg.cloudinaryUrl) return /^cloudinary:\/\/.+:.+@.+/.test(cfg.cloudinaryUrl);
  return !isPlaceholder(cfg.cloudName) && !isPlaceholder(cfg.apiKey) && !isPlaceholder(cfg.apiSecret);
}

if (hasCloudinaryConfig()) {
  const cfg = getCloudinaryConfig();
  if (cfg.cloudinaryUrl) {
    process.env.CLOUDINARY_URL = cfg.cloudinaryUrl;
    cloudinary.config({ secure: true });
  } else {
    cloudinary.config({
      cloud_name: cfg.cloudName,
      api_key: cfg.apiKey,
      api_secret: cfg.apiSecret,
      secure: true,
    });
  }
}

module.exports = { cloudinary, hasCloudinaryConfig, getCloudinaryConfig };
