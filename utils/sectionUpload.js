import multer from "multer";
import path from "path";
import fs from "fs";

const sectionUpload = (folder = "sections") => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = `uploads/${folder}/`;
      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const uniqueName = `${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}${ext}`;
      cb(null, uniqueName);
    },
  });

  const upload = multer({ storage });

  const anySectionFields = () => {
    return (req, res, next) => {
      upload.any()(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          return res
            .status(400)
            .json({ status: false, message: "File upload error" });
        } else if (err) {
          return res.status(400).json({ status: false, message: err.message });
        }
        next();
      });
    };
  };

  return {
    any: anySectionFields,
  };
};

export default sectionUpload;
