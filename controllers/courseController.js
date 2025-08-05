import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Category from "../models/Category.js";
import Section from "../models/Section.js";
import Upload from "../models/Upload.js";
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
      course_image,
      participant_ids = [],
      sections = [],
    } = req.body;

    const created_by = req.user._id;
    const user_type = req.user.user_type;

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

        await storeSections(sections, course._id);
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

      await storeSections(sections, course._id);
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
    const courseId = req.params.id;

    const course = await Course.findById(courseId).populate(
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

    if (course.course_image) {
      const imageDoc = await Upload.findById(course.course_image);
      result.course_image = imageDoc || null;
    } else {
      result.course_image = null;
    }

    const sections = await Section.find({ course_id: course._id }).lean();

    const gatherIds = (arr) =>
      Array.isArray(arr) ? arr.map((o) => o._id).filter(Boolean) : [];

    const imageIds = sections.flatMap((s) => gatherIds(s.image));
    const videoIds = sections.flatMap((s) => gatherIds(s.video));
    const documentIds = sections.flatMap((s) => gatherIds(s.document));
    const allUploadIds = [
      ...new Set([
        ...imageIds.map(String),
        ...videoIds.map(String),
        ...documentIds.map(String),
      ]),
    ];

    // Batch fetch uploads
    const uploads = await Upload.find({ _id: { $in: allUploadIds } }).lean();
    const uploadMap = uploads.reduce((m, u) => {
      m[u._id.toString()] = u;
      return m;
    }, {});

    // Replace the id wrappers with actual docs, filtering out missing ones
    const sectionsWithMedia = sections.map((section) => {
      const safeMap = (arr) =>
        Array.isArray(arr)
          ? arr
              .map((o) => {
                const key = o._id ? o._id.toString() : null;
                return key && uploadMap[key] ? uploadMap[key] : null;
              })
              .filter(Boolean)
          : [];

      return {
        ...section,
        image: safeMap(section.image),
        video: safeMap(section.video),
        document: safeMap(section.document),
      };
    });

    result.sections = sectionsWithMedia;

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
      course_image,
      sections = [],
      participant_ids = [],
    } = req.body;

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

    course.title = title.trim();
    course.description = description;
    course.category_id = category_id;
    course.status = status;
    course.user_type = user_type;
    course.course_image = course_image;

    const sourceSections = await Section.find({ course_id: courseId });

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
            course_image,
            status,
            user_type: 2,
            instructor_ids: [instructorId],
            assigned_to: [instructorId],
            created_by: userId,
          });
          await duplicateCourse.save();

          for (const sec of sourceSections) {
            const clonedSection = new Section({
              course_id: duplicateCourse._id.toString(),
              title: sec.title,
              lesson: sec.lesson,
              image: sec.image,
              video: sec.video,
              document: sec.document,
            });
            const savedSection = await clonedSection.save();

            // Clone uploads
            const uploads = await Upload.find({ section_id: sec._id });
            for (const file of uploads) {
              const clonedUpload = new Upload({
                file_name: file.file_name,
                file_path: file.file_path,
                file_title: file.file_title,
                section_id: savedSection._id,
              });
              console.log("clonedUpload", clonedUpload);
              await clonedUpload.save();
            }
          }
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

    const existingSections = sourceSections;
    const incomingSectionIds = sections
      .filter((s) => s._id && mongoose.Types.ObjectId.isValid(s._id))
      .map((s) => s._id.toString());

    console.log("existingSections", existingSections);
    console.log("incomingSectionIds", incomingSectionIds);

    const sectionsToDelete = existingSections.filter(
      (s) => !incomingSectionIds.includes(s._id.toString())
    );
    for (const sec of sectionsToDelete) {
      const allFileIds = [
        ...(sec.image || []),
        ...(sec.video || []),
        ...(sec.document || []),
      ].map((f) => f._id);

      if (allFileIds.length > 0) {
        const uploadedFiles = await Upload.find({ _id: { $in: allFileIds } });
        for (const file of uploadedFiles) {
          if (file?.file_path && fs.existsSync(file.file_path)) {
            fs.unlinkSync(file.file_path);
          }
        }
        await Upload.deleteMany({ _id: { $in: allFileIds } });
      }
      await Section.findByIdAndDelete(sec._id);
    }

    console.log("sections", sections);
    for (const sec of sections) {
      const isValidMongoId =
        sec._id && mongoose.Types.ObjectId.isValid(sec._id.toString());
      console.log("sec", sec);
      if (!isValidMongoId) {
        const newSec = new Section({
          course_id: courseId,
          title: sec.title,
          lesson: sec.lesson,
          image: sec.image || [],
          video: sec.video || [],
          document: sec.document || [],
        });
        console.log("newSec", newSec);
        await newSec.save();
      } else {
        const dbSection = await Section.findById(sec._id);
        if (!dbSection) continue;

        dbSection.title = sec.title;
        dbSection.lesson = sec.lesson;
        dbSection.image = sec.image || [];
        dbSection.video = sec.video || [];
        dbSection.document = sec.document || [];
        await dbSection.save();
      }
    }

    res.status(200).json({
      status: true,
      message: "Course updated successfully",
      data: course,
    });
  } catch (err) {
    if (uploadedFile) {
      const filePath = path.join("uploads", uploadedFile);
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
        .json({ status: false, message: "Course ID is required" });
    }

    const course = await Course.findById(id);
    if (!course) {
      return res
        .status(404)
        .json({ status: false, message: "Course not found" });
    }

    const sections = await Section.find({ course_id: id });
    for (const section of sections) {
      await deleteSectionFiles(section);
      await Section.findByIdAndDelete(section._id);
    }

    if (course.course_image) {
      const courseImageDoc = await Upload.findById(course.course_image);
      if (courseImageDoc && fs.existsSync(courseImageDoc.file_path)) {
        fs.unlinkSync(courseImageDoc.file_path);
      }
      await Upload.findByIdAndDelete(course.course_image);
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
          const relImgDoc = await Upload.findById(rel.course_image);
          if (relImgDoc && fs.existsSync(relImgDoc.file_path)) {
            fs.unlinkSync(relImgDoc.file_path);
          }
          await Upload.findByIdAndDelete(rel.course_image);
        }

        const relSections = await Section.find({ course_id: rel._id });
        for (const relSec of relSections) {
          await deleteSectionFiles(relSec);
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

const storeSections = async (sections, courseId) => {
  const sectionEntries = [];

  for (let i = 0; i < sections.length; i++) {
    const sectionData = sections[i] || {};

    const section = new Section({
      course_id: courseId,
      title: sectionData.title || `Untitled Section ${i}`,
      lesson: sectionData.lesson || "",
      image: sectionData.image || [],
      video: sectionData.video || [],
      document: sectionData.document || [],
    });

    await section.save();
    sectionEntries.push(section);
  }

  return sectionEntries;
};

const deleteSectionFiles = async (section) => {
  const fileGroups = [section.image, section.video, section.document].filter(
    Boolean
  );

  for (const group of fileGroups) {
    if (Array.isArray(group)) {
      for (const fileRef of group) {
        const fileDoc = await Upload.findById(fileRef._id);
        if (fileDoc && fs.existsSync(fileDoc.file_path)) {
          fs.unlinkSync(fileDoc.file_path);
        }
        await Upload.findByIdAndDelete(fileRef._id);
      }
    }
  }
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
