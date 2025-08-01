import Category from "../models/Category.js";
import Course from "../models/Course.js";
import User from "../models/User.js";

export const addCategory = async (req, res) => {
  try {
    const { id, name } = req.body;
    const userId = req.user._id;
    const userType = req.user.user_type;

    if (!name) {
      return res.status(400).json({ message: "Category name is required." });
    }

    let createdBy, assignedTo;

    if (userType === 1) {
      createdBy = userId;
      assignedTo = id;
    } else if (userType === 2) {
      createdBy = userId;
      assignedTo = userId;
    } else {
      return res.status(403).json({ message: "Unauthorized user type." });
    }

    const existing = await Category.findOne({ name, assigned_to: assignedTo });
    if (existing) {
      return res
        .status(409)
        .json({ message: "This category already exists for this user." });
    }

    const category = await Category.create({
      name,
      created_by: createdBy,
      assigned_to: assignedTo,
    });

    res.status(200).json({
      message: "Category has been created successfully.",
      status: true,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to create category.", error: err.message });
  }
};

export const getCategory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { search = "", limit = 10, page = 1 } = req.query;
    const userType = req.user.user_type;

    const numericLimit = parseInt(limit);
    const numericPage = parseInt(page);
    const offset = (numericPage - 1) * numericLimit;

    const query = {
      // created_by: userId,
      name: { $regex: search, $options: "i" },
      is_deleted: false,
    };

    if (userType === 1) {
      query.created_by = userId;
    } else if (userType === 2) {
      query.assigned_to = userId;
    } else {
      return res.status(403).json({ message: "Unauthorized user type." });
    }

    const totalRecords = await Category.countDocuments(query);
    const totalPages = Math.ceil(totalRecords / numericLimit);

    const data = await Category.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(numericLimit)
      .populate("assigned_to", "first_name last_name");

    res.status(200).json({
      pagination: {
        total_records: totalRecords,
        current_page: numericPage,
        limit: numericLimit,
        total_pages: totalPages,
      },
      data,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to retrieve categories.", error: err.message });
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Category ID is required." });
    }

    const category = await Category.findById(id).populate(
      "assigned_to",
      "first_name last_name"
    );

    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    res.status(200).json({
      status: true,
      data: category,
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to retrieve category.",
      error: err.message,
    });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const instructor_ids = req.body.id;

    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    const existingCategory = await Category.findOne({
      _id: { $ne: id },
      name: name.trim(),
      assigned_to: category.assigned_to,
    });

    if (existingCategory) {
      return res.status(409).json({
        message: "This category name already exists for the selected user.",
      });
    }

    const isCategoryUsed = await Course.findOne({ category_id: id });

    if (
      isCategoryUsed &&
      instructor_ids &&
      instructor_ids !== String(category.assigned_to)
    ) {
      return res.status(400).json({
        message:
          "Cannot change instructor. Category is already used in a course.",
      });
    }

    category.name = name.trim();

    if (instructor_ids && !isCategoryUsed) {
      category.assigned_to = instructor_ids;
    }

    await category.save();

    res.status(200).json({
      message: "Category has been updated successfully.",
      category,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to update category.", error: err.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.body;
    const userId = req.user._id;
    const userType = req.user.user_type;

    let categoryQuery = { _id: id };

    if (userType === 1) {
      categoryQuery.created_by = userId;
    } else if (userType === 2) {
      categoryQuery.$or = [{ created_by: userId }, { assigned_to: userId }];
    }

    const category = await Category.findOne(categoryQuery);

    if (!category) {
      return res.status(404).json({
        message:
          "Category not found or you do not have permission to delete it.",
      });
    }

    category.status = false;
    category.is_deleted = true;
    await category.save();

    await Course.updateMany(
      { category_id: id },
      { $set: { status: false, is_deleted: true } }
    );

    res.status(200).json({
      message:
        "Category and its related courses have been disabled successfully.",
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to disable category.",
      error: err.message,
    });
  }
  // try {
  //   const { id } = req.body;
  //   const userId = req.user._id;
  //   const category = await Category.findOneAndDelete({
  //     _id: id,
  //     created_by: userId,
  //   });

  //   if (!category) {
  //     return res.status(404).json({
  //       message:
  //         "Category not found or you do not have permission to delete it.",
  //     });
  //   }

  //   res
  //     .status(200)
  //     .json({ message: "Category has been deleted successfully." });
  // } catch (err) {
  //   res
  //     .status(500)
  //     .json({ message: "Failed to delete category.", error: err.message });
  // }
};

export const updateStatus = async (req, res) => {
  try {
    const { id, status } = req.body;
    const userId = req.user._id;
    const userType = req.user.user_type;

    if (!id || typeof status === "undefined") {
      return res
        .status(400)
        .json({ status: false, message: "User ID and status are required" });
    }

    let category;
    if (userType === 1) {
      category = await Category.findOne({ _id: id, created_by: userId });
    } else if (userType === 2) {
      category = await Category.findOne({ _id: id, assigned_to: userId });
    } else {
      return res.status(403).json({ message: "Unauthorized user type." });
    }

    if (!category) {
      return res.status(404).json({
        message:
          "Category not found or you do not have permission to update it.",
      });
    }

    const ownerId = category.assigned_to;
    const ownerUser = await User.findOne({ _id: ownerId });

    if (!ownerUser || !ownerUser.status === true) {
      return res.status(400).json({
        status: false,
        message:
          "The owner of this category is not active. Status cannot be changed.",
      });
    }

    category.status = status;
    await category.save();

    if (!category.status) {
      await Course.updateMany(
        { category_id: category._id, status: true },
        { $set: { status: false } }
      );
    }

    res.status(200).json({
      message: "Status changed successfully.",
      category,
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to update category status.",
      error: err.message,
    });
  }
};

export const userCategory = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    const data = await Category.find({
      $or: [{ created_by: userId }, { assigned_to: userId }],
    }).select("_id name");

    res.status(200).json({ data });
  } catch (err) {
    res.status(500).json({
      message: "Failed to retrieve categories.",
      error: err.message,
    });
  }
};

export const getCategoryOfUser = async (req, res) => {
  try {
    const { id } = req.params;
    const categories = await Category.find({
      $or: [{ created_by: id }, { assigned_to: id }],
    }).select("_id name");

    return res.status(200).json({
      status: true,
      message: "Categories fetched successfully",
      data: categories,
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: "Failed to fetch categories",
      error: err.message,
    });
  }
};
