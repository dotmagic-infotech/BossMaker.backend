import fs from "fs";
import path from "path";
import Fileupload from "../models/Upload.js";

export const uploadfile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const fileDoc = await Fileupload.create({
      file_name: req.file.originalname,
      file_path: path.relative(process.cwd(), req.file.path), 
      file_title: req.file.filename,
    });

    return res.status(200).json({
      message: "File uploaded successfully.",
      data: {
        _id: fileDoc._id,
        file_name: fileDoc.file_name,
        file_path: fileDoc.file_path,
        file_title: fileDoc.file_title,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

export const deleteFiles = async (req, res) => {
  try {
    const { ids } = req.body; 

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ status: false, message: "No file IDs provided." });
    }

    const files = await Fileupload.find({ _id: { $in: ids } });

    if (!files.length) {
      return res
        .status(404)
        .json({ status: false, message: "No matching files found." });
    }

    files.forEach((file) => {
      const filePath = path.join(process.cwd(), file.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    await Fileupload.deleteMany({ _id: { $in: ids } });

    return res.status(200).json({
      status: true,
      message: `${files.length} file(s) deleted successfully.`,
    });
  } catch (error) {
    console.error("Delete error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};

