import mongoose from "mongoose";

const uploadfile = new mongoose.Schema(
  {
    file_name: {
      type: String,
      trim: true,
    },
    file_path: {
      type: String,
      trim: true,
    },
    file_title: {
      type: String,
      trim: true,
    },
  },
);

const upload = mongoose.model("upload", uploadfile);
export default upload;
