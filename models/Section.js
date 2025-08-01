import mongoose from "mongoose";

// const sectionSchema = new mongoose.Schema({
//   course_id: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Course",
//     required: true,
//   },
//   title: {
//     type: String,
//     required: true,
//   },
//   lesson: {
//     type: String
//   },
//   image: [String],
//   video: [String],
//   document: [String],
//   created_at: {
//     type: Date,
//     default: Date.now,
//   },
// });

// export default mongoose.model("Section", sectionSchema);


const SectionSchema = new mongoose.Schema({
  course_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  title: { type: String, required: true },
  lesson: { type: String, default: "" },

  image: [
    {
      stored_name: String,
      original_name: String,
    },
  ],
  video: [
    {
      stored_name: String,
      original_name: String,
    },
  ],
  document: [
    {
      stored_name: String,
      original_name: String,
    },
  ],
});

export default mongoose.model("Section", SectionSchema);
