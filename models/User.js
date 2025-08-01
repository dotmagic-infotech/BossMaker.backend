import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    first_name: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    last_name: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },
    user_type: {
      type: Number,
      enum: [1, 2, 3],
      default: 3,
      required: true,
    },
    mobile_no: {
      type: String,
      default: null,
    },
    dob: {
      type: Date,
      default: null,
    },
    profile_image: {
      type: String, // You can store full URL or file path here
      default: null,
    },
    status: {
      type: Boolean,
      default: true, // true = active, false = inactive
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    permission: {
      type: Object,
      default: {
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
        Role: [
          {
            title: "View Role",
            module: "role",
            slug: "view_role",
            action: "view",
            _id: new mongoose.Types.ObjectId(),
            is_access: false,
          },
          {
            title: "Edit Role",
            module: "role",
            slug: "edit_role",
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
      },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("User", userSchema);
