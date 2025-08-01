import express from "express";
import {
  getUserProfile,
  updateProfile,
  changePassword,
} from "../controllers/profileController.js";
import { isValidToken } from "../controllers/authController.js";
import dynamicUpload from "../utils/upload.js";

const router = express.Router();
router.use(isValidToken);

const userProfileUpload = dynamicUpload("users");

router.get("/", getUserProfile);
router.put("/update", userProfileUpload("profile_image"), updateProfile);
router.post("/changePassword", changePassword);

export default router;
