import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const chunk1 =
      Date.now().toString(36) + crypto.randomBytes(6).toString("hex");
    const chunk2 = crypto.randomBytes(6).toString("hex");
    const uniqueName = `${chunk1}-${chunk2}${ext}`; 
    cb(null, uniqueName);
  },
});

export const uploadMiddleware = multer({ storage });
