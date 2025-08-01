import User from "../models/User.js";
import { encrypt, decrypt } from "../utils/crypto.js";
import fs from "fs";
import path from "path";

export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const decryptedPassword = decrypt(user.password);

    const profileImageURL = user.profile_image
      ? `${process.env.SERVER_URL}/uploads/users/${user.profile_image}`
      : null;

    const userData = {
      ...user.toObject(),
      password: decryptedPassword,
      profile_image: profileImageURL,
    };

    res.status(200).json({
      status: true,
      message: "User profile fetched successfully",
      data: userData,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: "Server error", error });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const { first_name, last_name, mobile_no, dob, profile_image } = req.body;
    const newImage = req.file ? req.file.filename : null;
    if (!first_name || !last_name) {
      return res.status(400).json({
        status: false,
        message: "First name and last name are required.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    if (newImage && user.profile_image) {
      const oldPath = path.join("uploads/users", user.profile_image);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    user.first_name = first_name;
    user.last_name = last_name;
    user.mobile_no = mobile_no ?? null;
    user.dob = dob ? new Date(dob) : null;
    if (newImage) user.profile_image = newImage;
    await user.save();

    res.status(200).json({
      status: true,
      message: "Profile updated successfully",
      data: {
        ...user.toObject(),
        password: "********",
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ status: false, message: "Server error", error: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { old_password, new_password, confirm_password } = req.body;

    if (!old_password || !new_password || !confirm_password) {
      return res.status(400).json({
        status: false,
        message: "All fields are required.",
      });
    }

    if (old_password === new_password) {
      return res.status(400).json({
        status: false,
        message: "Old password and New password do not match.",
      });
    }
    if (new_password !== confirm_password) {
      return res.status(400).json({
        status: false,
        message: "New password and confirm password do not match.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found.",
      });
    }

    const decryptedPassword = decrypt(user.password);

    if (decryptedPassword !== old_password) {
      return res.status(401).json({
        status: false,
        message: "Old password is incorrect.",
      });
    }

    const encryptedNewPassword = encrypt(new_password);
    user.password = encryptedNewPassword;
    await user.save();

    return res.status(200).json({
      status: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Password Change Error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error. Please try again later.",
    });
  }
};
