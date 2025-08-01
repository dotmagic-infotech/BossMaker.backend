import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Category from "../models/Category.js";
import Section from "../models/Section.js";
import {
  getCourseImageURL,
  getCourseVideoURL,
  getCourseDocumentURL,
} from "../utils/fileUrlUtils.js";

// const getImageURL = (filename) =>
//   filename ? `${process.env.SERVER_URL}/uploads/courses/${filename}` : null;

export const addCourse = async (req, res) => {
  try {
    const {
      title,
      description,
      category_id,
      status,
      instructor_ids,
      participant_ids = [],
    } = req.body;

    const created_by = req.user._id;
    const user_type = req.user.user_type;

    const courseImageFile = req.files.find(
      (f) => f.fieldname === "course_image"
    );
    const course_image = courseImageFile ? courseImageFile.filename : null;

    let rawRoleIds = [];

    if (user_type === 1) {
      if (Array.isArray(instructor_ids)) {
        rawRoleIds = instructor_ids;
      } else if (typeof instructor_ids === "string" && instructor_ids.trim()) {
        if (mongoose.Types.ObjectId.isValid(instructor_ids)) {
          rawRoleIds = [instructor_ids];
        } else {
          try {
            rawRoleIds = JSON.parse(instructor_ids);
          } catch {
            rawRoleIds = [];
          }
        }
      }
    } else if (user_type === 2) {
      if (Array.isArray(participant_ids)) {
        rawRoleIds = participant_ids;
      } else if (
        typeof participant_ids === "string" &&
        participant_ids.trim()
      ) {
        try {
          rawRoleIds = JSON.parse(participant_ids);
        } catch {
          rawRoleIds = [];
        }
      }
    }

    const roleIdsObjectIds = rawRoleIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (user_type === 1 && roleIdsObjectIds.length === 0) {
      return res.status(400).json({
        status: false,
        message: "At least one instructor must be selected.",
      });
    }

    const existing = await Course.findOne({ title, created_by: created_by });
    if (existing) {
      return res
        .status(409)
        .json({ status: false, message: "This course already exists." });
    }

    const duplicatedCourses = [];
    const parsedSections = parseBodySections(req.body);

    const courseData = {
      title,
      description,
      category_id,
      course_image,
      status,
      user_type: 2,
      created_by,
    };

    if (user_type === 1) {
      for (const roleId of roleIdsObjectIds) {
        const category = await Category.findOne({
          _id: category_id,
          $or: [
            { created_by: instructor_ids },
            { assigned_to: instructor_ids },
          ],
        });

        if (!category) {
          return res.status(400).json({
            status: false,
            message: `Category not found for this instructor.`,
          });
        }

        const course = await Course.create({
          ...courseData,
          instructor_ids: roleId,
          assigned_to: roleId,
        });

        await storeSections(req.files, course._id, parsedSections);
        duplicatedCourses.push(course);
      }
    }

    if (user_type === 2) {
      const category = await Category.findOne({
        _id: category_id,
        $or: [{ created_by: created_by }, { assigned_to: created_by }],
      });

      if (!category) {
        return res.status(400).json({
          status: false,
          message: "Category not found or not created by you (Bossmaker).",
        });
      }
      const course = await Course.create({
        ...courseData,
        participant_ids: roleIdsObjectIds,
        assigned_to: created_by,
      });

      await storeSections(req.files, course._id, parsedSections);
      duplicatedCourses.push(course);
    }

    res.status(200).json({
      status: true,
      message: "Course created Successfully",
      data: duplicatedCourses,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "Failed to create course",
      error: err.message,
    });
  }
};

export const getCourse = async (req, res) => {
  try {
    const userId = req.user._id;
    const { search = "", limit = 10, page = 1 } = req.query;
    const userType = req.user.user_type;

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const skip = (parsedPage - 1) * parsedLimit;

    const query = {
      is_deleted: false,
      $or: [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ],
    };

    if (userType === 1) {
      query.created_by = userId;
    } else if (userType === 2) {
      query.assigned_to = userId;
    } else {
      query.participant_ids = userId;
    }

    let courseQuery = Course.find(query)
      .populate("category_id", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit);

    if (userType === 1) {
      courseQuery = courseQuery.populate("assigned_to", "first_name last_name");
    } else if (userType === 2) {
      courseQuery = courseQuery.populate(
        "participant_ids",
        "first_name last_name"
      );
    }

    const [courses, totalCount] = await Promise.all([
      courseQuery.exec(),
      Course.countDocuments(query),
    ]);

    const formattedCourses = courses.map((course) => {
      const courseObj = course.toObject();
      const filename =
        typeof courseObj.course_image === "string"
          ? courseObj.course_image
          : courseObj.course_image?.filename;
      courseObj.course_image = getCourseImageURL(filename);
      return courseObj;
    });

    res.status(200).json({
      status: true,
      message: "Courses retrieved successfully",
      data: formattedCourses,
      pagination: {
        total_records: totalCount,
        current_page: parsedPage,
        limit: parsedLimit,
        total_pages: Math.ceil(totalCount / parsedLimit),
      },
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "Failed to retrieve courses",
      error: err.message,
    });
  }
};

export const getCourseById = async (req, res) => {
  try {
    const user_type = req.user.user_type;
    const course = await Course.findById(req.params.id).populate(
      "category_id",
      "name"
    );

    if (!course)
      return res
        .status(404)
        .json({ status: false, message: "Course not found" });

    const result = course.toObject();

    if (user_type === 1) {
      result.instructor_ids = course.assigned_to;
    } else if (user_type === 2) {
      const roleUsers = await User.find(
        { _id: { $in: course.participant_ids } },
        "_id first_name last_name"
      );
      result.participant_ids = roleUsers.map((user) => ({
        _id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
      }));
    }

    result.course_image = getCourseImageURL(
      course.course_image?.filename || course.course_image
    );

    const sections = await Section.find({ course_id: course._id });

    // result.sections = Array.isArray(sections)
    //   ? sections.map((section) => ({
    //       _id: section._id,
    //       title: section.title,
    //       lesson: section.lesson || "",
    //       image: Array.isArray(section.image)
    //         ? section.image.map((img) => getCourseImageURL(img.trim()))
    //         : typeof section.image === "string"
    //         ? section.image
    //             .split(",")
    //             .map((img) => getCourseImageURL(img.trim()))
    //         : [],
    //       video: Array.isArray(section.video)
    //         ? section.video.map((vid) => getCourseVideoURL(vid.trim()))
    //         : typeof section.video === "string"
    //         ? section.video
    //             .split(",")
    //             .map((vid) => getCourseVideoURL(vid.trim()))
    //         : [],
    //       document: Array.isArray(section.document)
    //         ? section.document.map((doc) => getCourseDocumentURL(doc.trim()))
    //         : typeof section.document === "string"
    //         ? section.document
    //             .split(",")
    //             .map((doc) => getCourseDocumentURL(doc.trim()))
    //         : [],
    //     }))
    //   : [];

    // result.sections = Array.isArray(sections)
    //   ? sections.map((section) => ({
    //       _id: section._id,
    //       title: section.title,
    //       lesson: section.lesson || "",
    //       image: Array.isArray(section.image)
    //         ? section.image.map((img) => getCourseImageURL(img.trim()))
    //         : typeof section.image === "string"
    //         ? section.image
    //             .split(",")
    //             .map((img) => getCourseImageURL(img.trim()))
    //         : [],
    //       video: Array.isArray(section.video)
    //         ? section.video.map((vid) => vid.trim())
    //         : typeof section.video === "string"
    //         ? section.video.split(",").map((vid) => vid.trim())
    //         : [],
    //       document: Array.isArray(section.document)
    //         ? section.document.map((doc) => doc.trim())
    //         : typeof section.document === "string"
    //         ? section.document.split(",").map((doc) => doc.trim())
    //         : [],
    //     }))
    //   : [];

    // result.sections = Array.isArray(sections)
    //   ? sections.map((section) => ({
    //       _id: section._id,
    //       title: section.title,
    //       lesson: section.lesson || "",

    //       image: Array.isArray(section.image)
    //         ? section.image.map((img) => ({
    //             stored_name: img.trim(),
    //             original_name: img.trim(),
    //           }))
    //         : typeof section.image === "string"
    //         ? section.image.split(",").map((img) => ({
    //             stored_name: img.trim(),
    //             original_name: img.trim(),
    //           }))
    //         : [],

    //       video: Array.isArray(section.video)
    //         ? section.video.map((vid) => ({
    //             stored_name: vid.trim(),
    //             original_name: vid.trim(),
    //           }))
    //         : typeof section.video === "string"
    //         ? section.video.split(",").map((vid) => ({
    //             stored_name: vid.trim(),
    //             original_name: vid.trim(),
    //           }))
    //         : [],

    //       document: Array.isArray(section.document)
    //         ? section.document.map((doc) => ({
    //             stored_name: doc.trim(),
    //             original_name: doc.trim(),
    //           }))
    //         : typeof section.document === "string"
    //         ? section.document.split(",").map((doc) => ({
    //             stored_name: doc.trim(),
    //             original_name: doc.trim(),
    //           }))
    //         : [],
    //     }))
    //   : [];

    result.sections = sections.map((section) => ({
      _id: section._id,
      title: section.title,
      lesson: section.lesson || "",
      image: section.image.map((file) => ({
        ...(file.toObject?.() || file),
        stored_name: getCourseImageURL(file.stored_name),
      })),
      video: section.video.map((file) => ({
        ...(file.toObject?.() || file),
        stored_name: getCourseVideoURL(file.stored_name),
      })),
      document: section.document.map((file) => ({
        ...(file.toObject?.() || file),
        stored_name: getCourseDocumentURL(file.stored_name),
      })),
    }));

    res.json({ status: true, course: result });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

export const updateCourse = async (req, res) => {
  let uploadedFile = null;
  try {
    const courseId = req.params.id;
    const userId = req.user._id;
    const user_type = req.user.user_type;
    const {
      title,
      description,
      category_id,
      status,
      instructor_ids,
      participant_ids = [],
      removedFiles = "[]",
    } = req.body;

    const removed = JSON.parse(removedFiles);

    let rawRoleIds = [];
    if (user_type === 1) rawRoleIds = parseIds(instructor_ids);
    else if (user_type === 2) rawRoleIds = parseIds(participant_ids);

    const roleIdsObjectIds = rawRoleIds
      .filter((id) => id)
      .map((id) => new mongoose.Types.ObjectId(id));

    if (user_type === 1 && roleIdsObjectIds.length === 0) {
      return res.status(400).json({
        status: false,
        message: "At least one instructor must be selected.",
      });
    }

    const course = await Course.findById(courseId);
    if (!course) throw new Error("Course not found");
    if (!title || !category_id) throw new Error("Missing required fields.");

    // === DELETE REMOVED FILES ===
    // for (const item of removed) {
    //   const sectionId = item.section_id;
    //   const section = await Section.findById(sectionId);
    //   if (!section) continue;

    //   for (const [type, files] of Object.entries(item.section)) {
    //     for (const file of files) {
    //       const filePath = path.join(UPLOADS_DIR, file.stored_name);
    //       if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    //       section[type] = section[type].filter(
    //         (f) => f._id.toString() !== file._id
    //       );
    //     }
    //   }
    //   await section.save();
    // }

    if (req.file) {
      uploadedFile = req.file.filename;
      if (course.course_image) {
        const oldImagePath = path.join("uploads/courses", course.course_image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      course.course_image = uploadedFile;
    }

    // === ADD NEW FILES ===
    // const files = req.files || {};
    // for (const field in files) {
    //   const match = field.match(/section\[(\d+)\](image|video|document)/);
    //   if (!match) continue;

    //   const index = match[1];
    //   const type = match[2];
    //   const sectionId = req.body[`section[${index}][id]`]; // Send sectionId in form

    //   const section = await Section.findById(sectionId);
    //   if (!section) continue;

    //   for (const file of files[field]) {
    //     const newFile = {
    //       stored_name: file.filename,
    //       original_name: file.originalname,
    //     };
    //     section[type].push(newFile);
    //     uploadedFiles.push(path.join(UPLOADS_DIR, file.filename));
    //   }

    //   await section.save();
    // }

    course.title = title.trim();
    course.description = description;
    course.category_id = category_id;
    course.status = status;
    course.user_type = user_type;

    if (user_type === 1) {
      const originalInstructorIds = Array.isArray(course.assigned_to)
        ? course.assigned_to.map((id) => id.toString()).sort()
        : course.assigned_to
        ? [course.assigned_to.toString()]
        : [];

      const newInstructorIds = roleIdsObjectIds
        .map((id) => id.toString())
        .sort();

      const isSameInstructors =
        originalInstructorIds.length === newInstructorIds.length &&
        originalInstructorIds.every(
          (val, index) => val === newInstructorIds[index]
        );

      if (isSameInstructors) {
        course.instructor_ids = roleIdsObjectIds;
        course.assigned_to = roleIdsObjectIds;
      } else {
        const conflict = await Course.findOne({
          _id: { $ne: courseId },
          title: title.trim(),
          assigned_to: { $in: roleIdsObjectIds },
        });

        if (conflict) {
          throw new Error(
            "One or more selected instructors already have this course assigned."
          );
        }

        for (const instructorId of roleIdsObjectIds) {
          const duplicateCourse = new Course({
            title: title.trim(),
            description,
            category_id,
            course_image: course.course_image,
            status,
            user_type: 2,
            instructor_ids: [instructorId],
            assigned_to: [instructorId],
            created_by: userId,
          });
          await duplicateCourse.save();
        }

        return res.status(200).json({
          status: true,
          message: "New course(s) assigned to instructors successfully",
        });
      }
    }

    if (user_type === 2) {
      course.participant_ids = roleIdsObjectIds;
    }

    await course.save();

    res.status(200).json({
      status: true,
      message: "Course updated successfully",
      data: course,
    });
  } catch (err) {
    if (uploadedFile) {
      const filePath = path.join("uploads/courses", uploadedFile);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.body;
    const userId = req.user._id;
    const userType = req.user.user_type;

    if (!id) {
      return res
        .status(400)
        .json({ status: false, message: "User ID is required" });
    }

    const course = await Course.findById(id);
    if (!course) {
      return res
        .status(404)
        .json({ status: false, message: "Course not found" });
    }

    const sections = await Section.find({ course_id: id });

    for (const section of sections) {
      const fileGroups = [
        section.image,
        section.video,
        section.document,
      ].filter(Boolean);

      for (const group of fileGroups) {
        if (Array.isArray(group)) {
          for (const file of group) {
            const storedName = file.stored_name;
            if (storedName) {
              const fullPath = path.join("uploads/courses", storedName);
              if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
              }
            }
          }
        }
      }
      await Section.findByIdAndDelete(section._id);
    }

    if (course.course_image) {
      const imagePath = path.join("uploads/courses", course.course_image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    if (userType === 1) {
      const relatedCourses = await Course.find({
        title: course.title,
        category_id: course.category_id,
        assigned_to: userId,
        user_type: { $in: [2, 3] },
      });

      for (const rel of relatedCourses) {
        if (rel.course_image) {
          const relImgPath = path.join("uploads/courses", rel.course_image);
          if (fs.existsSync(relImgPath)) {
            fs.unlinkSync(relImgPath);
          }
        }
        const relSections = await Section.find({ course_id: rel._id });
        for (const relSec of relSections) {
          const fileGroups = [
            relSec.image,
            relSec.video,
            relSec.document,
          ].filter(Boolean);

          for (const group of fileGroups) {
            if (Array.isArray(group)) {
              for (const file of group) {
                const storedName = file.stored_name;
                if (storedName) {
                  const filePath = path.join("uploads/sections", storedName); // adjust folder if needed
                  if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                  }
                }
              }
            }
          }
          await Section.findByIdAndDelete(relSec._id);
        }

        await Course.findByIdAndDelete(rel._id);
      }
    }

    await Course.findByIdAndDelete(id);

    res.json({ status: true, message: "Course deleted successfully" });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const { id, status } = req.body;
    const userId = req.user._id;
    const userType = req.user.user_type;

    if (!id || typeof status === "undefined") {
      return res
        .status(400)
        .json({ status: false, message: "Course ID and status are required" });
    }

    const course = await Course.findById(id);
    if (!course) {
      return res
        .status(404)
        .json({ status: false, message: "Course not found" });
    }

    if (status === true) {
      const category = await Category.findById(course.category_id);
      if (!category || category.status === false) {
        return res.status(400).json({
          status: false,
          message:
            "Cannot activate course. Its category is inactive or deleted.",
        });
      }
    }

    course.status = status;
    await course.save();

    // Find related copies
    let filter = null;

    if (userType === 1) {
      filter = {
        assigned_to: userId,
        user_type: { $in: [2, 3] },
        created_by: { $in: course.instructor_ids },
      };
    } else if (userType === 2) {
      filter = {
        assigned_to: userId,
        user_type: 3,
        created_by: { $in: course.participant_ids },
      };
    }

    if (filter) {
      const updateResult = await Course.updateMany(filter, { status });
    }

    res.json({
      status: true,
      message: "Course status updated successfully",
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

const parseBodySections = (reqBody) => {
  const parsed = {};

  Object.entries(reqBody).forEach(([key, value]) => {
    const match = key.match(
      /^sections\[(\d+)\](?:\.|\[)(title|lesson)(?:\])?$/
    );
    if (match) {
      const index = match[1];
      const field = match[2];

      if (!parsed[index]) parsed[index] = {};
      parsed[index][field] = value;
    }
  });

  return parsed;
};

const storeSections = async (files, courseId, bodySections = {}) => {
  const fileMap = {};

  files.forEach((file) => {
    const match = file.fieldname.match(
      /^sections\[(\d+)\]\.(image|video|document)$/
    );
    if (!match) return;

    const index = match[1];
    const type = match[2];

    if (!fileMap[index]) {
      fileMap[index] = {
        image: [],
        video: [],
        document: [],
      };
    }

    // if (type === "image") {
    //   fileMap[index].image.push(file.filename);
    // } else if (type === "video") {
    //   fileMap[index].video.push(file.filename);
    // } else if (type === "document") {
    //   fileMap[index].document.push(file.filename);
    // }
    fileMap[index][type].push({
      stored_name: file.filename,
      original_name: file.originalname,
    });
  });

  const sectionEntries = [];

  // for (const [index, fileGroup] of Object.entries(fileMap)) {
  //   const sectionData = bodySections[index] || {};
  //   const title = sectionData.title || `Untitled Section ${index}`;
  //   const lesson = sectionData.lesson || "";

  //   const section = new Section({
  //     course_id: courseId,
  //     title,
  //     lesson,
  //     image: fileGroup.image,
  //     video: fileGroup.video,
  //     document: fileGroup.document,
  //   });

  //   await section.save();
  //   sectionEntries.push(section);
  // }

  const allIndices = new Set([
    ...Object.keys(bodySections),
    ...Object.keys(fileMap),
  ]);

  for (const index of allIndices) {
    const sectionData = bodySections[index] || {};
    const fileGroup = fileMap[index] || { image: [], video: [], document: [] };

    const title = sectionData.title || `Untitled Section ${index}`;
    const lesson = sectionData.lesson || "";

    const section = new Section({
      course_id: courseId,
      title,
      lesson,
      image: fileGroup.image,
      video: fileGroup.video,
      document: fileGroup.document,
    });

    await section.save();
    sectionEntries.push(section);
  }

  return sectionEntries;
};

function parseIds(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [value];
    }
  }
  return [];
}
