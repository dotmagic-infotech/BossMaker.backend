import dotenv from "dotenv";
dotenv.config();

const BASE_URL = process.env.SERVER_URL || "http://localhost:5000";

export const getCourseImageURL = (filename) =>
  filename ? `${BASE_URL}/uploads/courses/${filename}` : null;
export const getCourseVideoURL = (filename) =>
  filename ? `${BASE_URL}/uploads/courses/${filename}` : null;
export const getCourseDocumentURL = (filename) =>
  filename ? `${BASE_URL}/uploads/courses/${filename}` : null;
