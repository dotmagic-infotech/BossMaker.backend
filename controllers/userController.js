import fs from "fs";
import path from "path";
import { encrypt, decrypt } from "../utils/crypto.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Category from "../models/Category.js";
import Section from "../models/Section.js";
import Upload from "../models/Upload.js";
import {
  defaultPermissions,
  studentPermissions,
} from "../config/defaultPermissions.js";

const getImageURL = (req, filename) =>
  filename
    ? `${req.protocol}://${req.get("host")}/uploads/users/${filename}`
    : null;

export const createUser = async (req, res) => {
  let uploadedFile = null;
  try {
    const {
      first_name,
      last_name,
      email,
      password,
      user_type,
      mobile_no,
      dob,
      status,
    } = req.body;

    const created_by = req.user._id;
    const trimmedEmail = email?.trim();

    if (req.file) uploadedFile = req.file.filename;

    if (!first_name || !last_name || !email || !password || !mobile_no) {
      throw new Error("Missing required fields.");
    }

    const existingUser = await User.findOne({ email: trimmedEmail });

    if (existingUser) {
      throw new Error("Email already exists.");
    }

    const encryptedPassword = encrypt(password);

    const newUser = new User({
      first_name,
      last_name,
      email,
      password: encryptedPassword,
      user_type,
      mobile_no,
      dob: dob || null,
      status: status || false,
      permission: user_type === "3" ? studentPermissions : defaultPermissions,
      created_by,
    });

    if (req.file) newUser.profile_image = req.file.filename;

    await newUser.save();

    res
      .status(200)
      .json({ status: true, message: "User created successfully" });
  } catch (error) {
    if (uploadedFile) {
      const filePath = path.join("uploads/users", uploadedFile);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    res.status(400).json({ status: false, message: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const { search = "", limit = 10, page = 1 } = req.query;

    const numericLimit = parseInt(limit);
    const numericPage = parseInt(page);
    const offset = (numericPage - 1) * numericLimit;

    const query = {
      user_type: req.user.user_type === 1 ? 2 : 3,
      created_by: req.user._id,
      $or: [
        { first_name: { $regex: search, $options: "i" } },
        { last_name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    };

    const totalRecords = await User.countDocuments(query);
    const totalPages = Math.ceil(totalRecords / numericLimit);

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(numericLimit);

    const result = users.map((u) => {
      const user = u.toObject();
      user.profile_image = getImageURL(req, user.profile_image);
      return user;
    });

    res.status(200).json({
      status: true,
      pagination: {
        total_records: totalRecords,
        current_page: numericPage,
        limit: numericLimit,
        total_pages: totalPages,
      },
      users: result,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

export const getAllBossmaker = async (req, res) => {
  try {
    const createdBy = req.user._id;
    const bossmakers = await User.find(
      { user_type: 2, created_by: createdBy },
      "_id first_name last_name"
    ).sort({ createdAt: -1 });

    res.status(200).json({
      status: true,
      data: bossmakers,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

export const getAllParticipants = async (req, res) => {
  try {
    const createdBy = req.user._id;
    const bossmakers = await User.find(
      { user_type: 3, created_by: createdBy },
      "_id first_name last_name"
    ).sort({ createdAt: -1 });

    res.status(200).json({
      status: true,
      data: bossmakers,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    const result = user.toObject();
    result.password = decrypt(user.password);
    result.profile_image = getImageURL(req, user.profile_image);

    res.json({ status: true, user: result });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

export const updateUser = async (req, res) => {
  let uploadedFile = null;
  try {
    // const created_by = req.user._id;
    const user = await User.findById(req.params.id);
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    const {
      first_name,
      last_name,
      email,
      password,
      user_type,
      mobile_no,
      dob,
      status,
    } = req.body;

    if (req.file) uploadedFile = req.file.filename;

    if (!first_name || !last_name || !email || !password) {
      throw new Error("Missing required fields.");
    }
    const existingUser = await User.findOne({
      email: email.trim(),
      _id: { $ne: user._id },
    });
    if (existingUser) {
      throw new Error("Email already exists.");
    }

    if (req.file) {
      if (user.profile_image) {
        const oldPath = path.join("uploads/users", user.profile_image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      user.profile_image = req.file.filename;
    }

    const encryptedPassword = encrypt(password);

    if (first_name) user.first_name = first_name;
    if (last_name) user.last_name = last_name;
    if (email) user.email = email;
    if (password) user.password = encryptedPassword;
    if (user_type) user.user_type = user_type;
    if (mobile_no) user.mobile_no = mobile_no;
    if (dob) user.dob = dob;
    if (status) user.status = status;

    await user.save();

    res.json({ status: true, message: "User updated Succesfully" });
  } catch (error) {
    if (uploadedFile) {
      const filePath = path.join("uploads/users", uploadedFile);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    res.status(400).json({ status: false, message: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res
        .status(400)
        .json({ status: false, message: "User ID is required" });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    if (user.user_type === 2) {
      const courses = await Course.find({
        $or: [{ created_by: id }, { assigned_to: id }],
      });

      for (const course of courses) {
        if (course.course_image) {
          const imageDoc = await Upload.findById(course.course_image);
          if (imageDoc?.file_path) {
            const courseImagePath = path.join(imageDoc.file_path);
            if (fs.existsSync(courseImagePath)) fs.unlinkSync(courseImagePath);
          }
          await Upload.deleteOne({ _id: course.course_image });
        }        

        const sections = await Section.find({ course_id: course._id });

        for (const section of sections) {
          const allFiles = [
            ...(section.image || []),
            ...(section.video || []),
            ...(section.document || []),
          ];

          for (const fileObj of allFiles) {
            const uploadDoc = await Upload.findById(fileObj._id); // <-- Fetch full upload document
            if (uploadDoc?.file_path) {
              const filePath = path.join(uploadDoc.file_path);
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
              }
            }
            await Upload.deleteOne({ _id: fileObj._id });
          }          
          
          await Section.findByIdAndDelete(section._id);
        }
        await Course.findByIdAndDelete(course._id);
      }

      const participants = await User.find({ created_by: id, user_type: 3 });
      for (const participant of participants) {
        if (participant.profile_image) {
          const pImagePath = path.join(
            "uploads/users",
            String(participant.profile_image)
          );
          if (fs.existsSync(pImagePath)) fs.unlinkSync(pImagePath);
        }
        await User.findByIdAndDelete(participant._id);
      }
      await Category.deleteMany({
        $or: [{ created_by: id }, { assigned_to: id }],
      });
    }

    if (user.profile_image) {
      const filePath = path.join("uploads/users", user.profile_image);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({ status: true, message: "User deleted Successfully" });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

export const chackUserStatus = async (req, res) => {
  const userId = req.params.id;
  if (!userId) {
    return res
      .status(400)
      .json({ status: false, message: "User ID is required" });
  }
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ status: false, message: "User not found" });
  }
  const isActive = user.status;
  const message = isActive ? "User is active" : "Your account is disabled";
  return res.status(200).json({ status: true, isActive, message });
};

export const updateUserStatus = async (req, res) => {
  try {
    const { id, status } = req.body;
    const userType = req.user.user_type;

    if (!id || typeof status === "undefined") {
      return res
        .status(400)
        .json({ status: false, message: "User ID and status are required" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    user.status = status;
    await user.save();

    if (userType === 1 && user.user_type === 2 && status === false) {
      const bossmakerId = user._id;

      await User.updateMany(
        { created_by: bossmakerId, user_type: 3 },
        { status: false }
      );

      await Category.updateMany(
        {
          $or: [{ created_by: bossmakerId }, { assigned_to: bossmakerId }],
        },
        {
          $set: {
            status: false,
          },
        }
      );

      const courses = await Course.find({
        $or: [{ created_by: bossmakerId }, { assigned_to: bossmakerId }],
      });

      const courseIds = courses.map((c) => c._id);

      await Course.updateMany({ _id: { $in: courseIds } }, { status: false });
    }

    res.json({
      status: true,
      message: "User status updated successfully",
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

export const updateUserPermissions = async (req, res) => {
  try {
    const { id, permissions } = req.body;

    if (!id || !Array.isArray(permissions)) {
      return res.status(400).json({
        status: false,
        message: "User ID and permission array are required",
      });
    }

    const user = await User.findById(id);
    if (!user.created_by) {
      user.created_by = req.user?._id || null;
    }
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    let isChanged = false;

    for (const moduleKey in user.permission) {
      const modulePermissions = user.permission[moduleKey];

      if (!Array.isArray(modulePermissions)) continue;

      user.permission[moduleKey] = modulePermissions.map((perm) => {
        const match = permissions.find((p) => p.id === perm._id.toString());
        if (match && perm.is_access !== match.is_access) {
          perm.is_access = match.is_access;
          isChanged = true;
        }
        return perm;
      });
    }

    if (isChanged) {
      user.markModified("permission");
      await user.save();
    }

    res.status(200).json({
      status: true,
      message: "Permissions updated successfully",
    });
  } catch (error) {
    res.status(400).json({ status: false, message: error.message });
  }
};

export const getPermissions = async (req, res) => {
  try {
    const id = req.params.id;

    if (!id) {
      return res.status(400).json({
        status: false,
        message: "User ID is required",
      });
    }

    const user = await User.findById(id);
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    return res.status(200).json({
      status: true,
      message: "Permissions fetched successfully",
      permission: user.permission || defaultPermissions,
    });
  } catch (error) {
    res.status(400).json({ status: false, message: error.message });
  }
};
