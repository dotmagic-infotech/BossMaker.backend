import express from "express";
import {
  addCategory,
  getCategory,
  getCategoryById,
  updateCategory,
  deleteCategory,
  updateStatus,
  userCategory,
  getCategoryOfUser,
} from "../controllers/categoryController.js";
import { isValidToken } from "../controllers/authController.js";

const router = express.Router();
router.use(isValidToken);

router.post("/create", addCategory);
router.get("/", getCategory);
router.get("/findbyid/:id", getCategoryById);
router.get("/usercategory", userCategory);
router.put("/update/:id", updateCategory);
router.delete("/delete", deleteCategory);
router.patch("/status", updateStatus);
router.get("/finduserbycategory/:id", getCategoryOfUser);

export default router;
