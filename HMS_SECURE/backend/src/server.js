require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { connectDB, mongoose } = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const app = express();
const PORT = process.env.PORT || 5000;
app.set("trust proxy", Number(process.env.TRUST_PROXY || 1));
app.use(helmet());
const allowedOrigins = Array.from(new Set([
    ...(process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL.split(",")
        : ["http://localhost:5173", "http://localhost:3000"]),
    ...(process.env.CORS_EXTRA_ORIGINS ? process.env.CORS_EXTRA_ORIGINS.split(",") : []),
]))
    .map((x) => x.trim())
    .filter(Boolean);
app.use(
    cors({
        origin: (origin, cb) => {
            if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
            return cb(new Error(`CORS blocked for origin: ${origin}`));
        },
        credentials: true,
    }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(
    "/api",
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: Number(process.env.RATE_LIMIT_MAX || 500),
        standardHeaders: true,
        legacyHeaders: false,
    }),
);
app.get("/", (req, res) =>
    res.json({
        message: "Enterprise HMS Backend Running",
        database: "MongoDB Atlas ready",
    }),
);
app.get("/api/health", async (req, res, next) => {
    try {
        await connectDB();
        res.json({
            status: "ok",
            database:
                mongoose.connection.readyState === 1 ? "connected" : "connecting",
        });
    } catch (e) {
        next(e);
    }
});
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api", require("./routes/tenant.routes"));
app.use("/api/patients", require("./routes/patient.routes"));
app.use("/api", require("./routes/core.routes"));
app.use("/api", require("./routes/opd-ipd.routes"));
app.use("/api", require("./routes/lab-radiology.routes"));
app.use("/api/pharmacy", require("./routes/pharmacy.routes"));
app.use("/api/inventory", require("./routes/inventory.routes"));
app.use("/api/billing", require("./routes/billing.routes"));
app.use("/api", require("./routes/insurance-tpa.routes"));
app.use("/api", require("./routes/notification.routes"));
app.use("/api", require("./routes/communication.routes"));
app.use("/api", require("./routes/portal.routes"));
app.use("/api", require("./routes/emr.routes"));
app.use("/api", require("./routes/audit-security.routes"));
app.use("/api", require("./routes/compliance.routes"));
app.use("/api", require("./routes/integration.routes"));
app.use("/api", require("./routes/hl7.routes"));
app.use("/api", require("./routes/pacs-dicom.routes"));
app.use("/api", require("./routes/abdm-abha.routes"));
app.use("/api", require("./routes/erp-tally.routes"));
app.use("/api", require("./routes/enterprise-features.routes"));
app.use("/api", require("./routes/command-center.routes"));
app.use("/api", require("./routes/reports.routes"));
app.use("/api", require("./routes/ot-surgery.routes"));
app.use("/api", require("./routes/nursing.routes"));
app.use("/api", require("./routes/emergency.routes"));
app.use("/api", require("./routes/blood-bank.routes"));
app.use("/api", require("./routes/hr-staff.routes"));
app.use("/api", require("./routes/operations.routes"));
app.use("/api", require("./routes/configuration.routes"));
app.use("/api", require("./routes/template.routes"));
app.use("/api", require("./routes/subscription.routes"));
app.use("/api", require("./routes/saas.routes"));
app.use("/api", require("./routes/saas-billing.routes"));
app.use("/api", require("./routes/saas-business.routes"));
app.use("/api", require("./routes/saas-customer-success.routes"));
app.use("/api", require("./routes/saas-support.routes"));
app.use("/api", require("./routes/saas-knowledge-base.routes"));
app.use("/api", require("./routes/sales.routes"));
app.use("/api", require("./routes/legal-security.routes"));
app.use("/api", require("./routes/pilot.routes"));
app.use("/api", require("./routes/tenant-database.routes"));
app.use(notFound);
app.use(errorHandler);
if (require.main === module) {
    connectDB()
        .then(() =>
            app.listen(PORT, () => console.log(`API running on port ${PORT}`)),
        )
        .catch((err) => {
            console.error("MongoDB connection failed:", err.message);
            process.exit(1);
        });
}

module.exports = app;
