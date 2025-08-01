import mongoose from "mongoose";

export const defaultPermissions = {
  Category: [
    {
      title: "View Category",
      module: "category",
      slug: "view_category",
      action: "view",
      _id: new mongoose.Types.ObjectId(),
      is_access: false,
    },
    {
      title: "Edit Category",
      module: "category",
      slug: "edit_category",
      action: "edit",
      _id: new mongoose.Types.ObjectId(),
      is_access: false,
    },
  ],
  Participants: [
    {
      title: "View Participants",
      module: "participants",
      slug: "view_participants",
      action: "view",
      _id: new mongoose.Types.ObjectId(),
      is_access: false,
    },
    {
      title: "Edit Participants",
      module: "participants",
      slug: "edit_participants",
      action: "edit",
      _id: new mongoose.Types.ObjectId(),
      is_access: false,
    },
  ],
  Course: [
    {
      title: "View Course",
      module: "course",
      slug: "view_course",
      action: "view",
      _id: new mongoose.Types.ObjectId(),
      is_access: false,
    },
    {
      title: "Edit Course",
      module: "course",
      slug: "edit_course",
      action: "edit",
      _id: new mongoose.Types.ObjectId(),
      is_access: false,
    },
  ],
};

export const studentPermissions = {
  StudentCourses: [
    {
      title: "Courses",
      module: "studentCourses",
      slug: "view_studentCourses",
      action: "view",
      _id: new mongoose.Types.ObjectId(),
      is_access: true,
    },
  ],
};
