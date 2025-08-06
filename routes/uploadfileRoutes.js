import express from "express";
import { uploadfile, deleteFiles } from "../controllers/uploadfileController.js";
import { uploadMiddleware } from "../utils/singleFileUpload.js";

const router = express.Router();

router.post("/", uploadMiddleware.single("file"), uploadfile);
router.delete("/delete", deleteFiles);

export default router;
