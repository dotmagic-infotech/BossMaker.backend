import User from "../models/User.js";
import { decrypt } from "../utils/crypto.js";
import jwt from "jsonwebtoken";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ status: false, message: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid credentials." });
    }

    const decryptedPassword = decrypt(user.password);
    if (password !== decryptedPassword) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid credentials." });
    }

    if (
      (user.user_type === 2 || user.user_type === 3) &&
      user.status === false
    ) {
      return res.status(403).json({
        status: false,
        message:
          "Your account is deactivated. Please contact your administrator.",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        user_type: user.user_type,
        mobile_no: user.mobile_no ?? null,
        profile_image : `${process.env.SERVER_URL}/uploads/users/${user.profile_image}` ?? null,
        dob: user.dob ?? null,
        permission: user.permission ?? null,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      status: true,
      message: "Login Successful",
      token,
      data: {
        id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        user_type: user.user_type,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

export const isValidToken = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader)
      return res.status(401).json({
        status: false,
        message: "Authorization header missing. Access denied.",
        jwtExpired: true,
      });

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : authHeader;
    const verified = jwt.verify(token, process.env.JWT_SECRET);

    if (!verified)
      return res.status(401).json({
        status: false,
        message: "Invalid or expired token. Access denied.",
        jwtExpired: true,
      });

    const user = await User.findOne({ _id: verified.id });
    if (!user)
      return res.status(401).json({
        status: false,
        message: "User not found. Access denied.",
        jwtExpired: true,
      });
    else {
      req.user = user;
      next();
    }
  } catch (err) {
    res.status(500).json({
      status: false,
      message:
        err.name === "TokenExpiredError"
          ? "Token has expired. Please login again."
          : "Authentication failed. " + err.message,
      jwtExpired: true,
    });
  }
};

// export const register = async (req, res) => {
//   try {
//     const { first_name, last_name, email, password, user_type } = req.body;

//     if (!first_name || !last_name || !email || !password || !user_type) {
//       return res
//         .status(400)
//         .json({ message: "Please fill all required fields." });
//     }
//     const existingUser = await User.findOne({ email: email });
//     if (existingUser)
//       return res
//         .status(400)
//         .json({ message: "An account with this email already exists." });

//     const hashed = await bcrypt.hash(password, 10);
//     const data = await User.create({
//       first_name,
//       last_name,
//       email,
//       password: hashed,
//       user_type,
//     });

//     const token = jwt.sign(
//       {
//         id: data._id,
//         first_name: data.first_name,
//         last_name: data.last_name,
//         email: data.email,
//         user_type: data.user_type,
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     res.status(200).json({
//       status: true,
//       message: "Registration completed successfully.",
//       token,
//     });
//   } catch (err) {
//     res.status(500).json({
//       status: false,
//       message: err.message,
//     });
//   }
// };
