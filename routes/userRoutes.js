import express from "express";
import dynamicUpload from "../utils/upload.js";
import {
  createUser,
  getAllUsers,
  getAllBossmaker,
  getAllParticipants,
  getUserById,
  updateUser,
  deleteUser,
  chackUserStatus,
  updateUserStatus,
  updateUserPermissions,
  getPermissions,
} from "../controllers/userController.js";
import { isValidToken } from "../controllers/authController.js";
import { isSuperAdmin } from "../middlewares/checkPermission.js";

const router = express.Router();

router.use(isValidToken);

const userUpload = dynamicUpload("users");

router.post("/create", userUpload("profile_image"), createUser);
router.get("/", getAllUsers);
router.get("/instructors", getAllBossmaker);
router.get("/participants", getAllParticipants);
router.get("/:id", getUserById);
router.put("/update/:id", userUpload("profile_image"), updateUser);
router.delete("/delete", deleteUser);
router.get("/status/:id", chackUserStatus);
router.patch("/status", updateUserStatus);
router.put("/update-permissions", isSuperAdmin, updateUserPermissions);
router.get("/permissions/:id", isSuperAdmin, getPermissions);

export default router;
