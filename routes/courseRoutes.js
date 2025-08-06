import express from "express";
// import sectionUpload from "../utils/sectionUpload.js";

import {
  addCourse,
  getCourse,
  getCourseById,
  updateCourse,
  deleteCourse,
  updateStatus,
} from "../controllers/courseController.js";
import { isValidToken } from "../controllers/authController.js";

const router = express.Router();
router.use(isValidToken);

// const uploadSection = sectionUpload("courses");

router.post("/create", addCourse);
router.get("/", getCourse);
router.get("/:id", getCourseById);
router.put("/update/:id", updateCourse);
router.delete("/delete", deleteCourse);
router.patch("/status", updateStatus);

export default router;
