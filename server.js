// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import "express-async-errors"; // auto catches async errors
import morgan from "morgan";

// Route imports
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
// (import other routes similarly if you have them)
// e.g., import categoryRoutes from "./routes/categoryRoutes.js";

dotenv.config();

// MongoDB connection helper
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI not defined");
    await mongoose.connect(process.env.MONGO_URI, {
      // optionally you can pass options here
      // useNewUrlParser: true, useUnifiedTopology: true
    });
    console.log("🗄️  MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

// Connection event listeners (for extra visibility)
mongoose.connection.on("connected", () => console.log("🟢 Mongoose connected"));
mongoose.connection.on("error", (err) =>
  console.error("Mongoose connection error:", err)
);

connectDB();

// __dirname setup for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Express app init
const app = express();

// Middleware
app.use(morgan("dev"));
app.use(cors());
app.use((req, res, next) => {
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() })
);

// Static uploads (if used)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
// mount other routes here, e.g.:
// app.use("/api/categories", categoryRoutes);

/////////////////////////
// Global error handler
app.use((err, req, res, next) => {
  console.error("🔥 Unhandled error:", err.stack || err);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
