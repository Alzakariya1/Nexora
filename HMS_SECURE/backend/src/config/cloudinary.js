const cloudinary = require("cloudinary").v2;

function cleanEnv(value) {
    return String(value || "").trim().replace(/^['\"]|['\"]$/g, "");
}

function isPlaceholder(value) {
    const v = cleanEnv(value).toLowerCase();
    return !v ||
        v.includes("your_actual_") ||
        v.includes("your_cloudinary") ||
        v.includes("replace_") ||
        v.includes("change_this") ||
        v === "cloud_name" ||
        v === "api_key" ||
        v === "api_secret";
}

function hasCloudinaryConfig() {
    // Cloudinary supports either CLOUDINARY_URL or the three separate variables.
    if (!isPlaceholder(process.env.CLOUDINARY_URL)) return true;

    return !isPlaceholder(process.env.CLOUDINARY_CLOUD_NAME) &&
        !isPlaceholder(process.env.CLOUDINARY_API_KEY) &&
        !isPlaceholder(process.env.CLOUDINARY_API_SECRET);
}

function configureCloudinary() {
    if (!hasCloudinaryConfig()) return false;

    if (!isPlaceholder(process.env.CLOUDINARY_URL)) {
        cloudinary.config({
            cloudinary_url: cleanEnv(process.env.CLOUDINARY_URL),
            secure: true,
        });
        return true;
    }

    cloudinary.config({
        cloud_name: cleanEnv(process.env.CLOUDINARY_CLOUD_NAME),
        api_key: cleanEnv(process.env.CLOUDINARY_API_KEY),
        api_secret: cleanEnv(process.env.CLOUDINARY_API_SECRET),
        secure: true,
    });
    return true;
}

configureCloudinary();

module.exports = { cloudinary, hasCloudinaryConfig, configureCloudinary, cleanEnv };
