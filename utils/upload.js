import multer from "multer";
import path from "path";
import fs from "fs";

const dynamicUpload = (folder = "general") => {
  
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = `uploads/${folder}/`;
      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, filename);
    },
  });
  
  const fileFilter = (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, JPG, PNG, WEBP formats allowed"), false);
    }
    cb(null, true);
  };
  
  const upload = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 3 * 1024 * 1024,
    },
  });
  
  return (fieldName) => {
    return (req, res, next) => {
      upload.single(fieldName)(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          let message = "File upload error";
          if (err.code === "LIMIT_FILE_SIZE") {
            message = "File too large. Max 3MB allowed.";
          }
          return res.status(400).json({ status: false, message });
        } else if (err) {
          return res.status(400).json({ status: false, message: err.message });
        }
        next();
      });
    };
  };
};

export default dynamicUpload;
