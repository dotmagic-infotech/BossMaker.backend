export const isSuperAdmin = (req, res, next) => {
  if (req.user.user_type !== 1) {
    return res.status(403).json({ status: false, message: "Unauthorized" });
  }
  next();
};
