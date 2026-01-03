const User = require("../models/user.model");
const fileUploaderOnCloudinary = require("../utils/cloudinary");

const updateAccount = async (req, res) => {
  try {
    const data = req.body;
    const fields = Object.keys(data).join(" ");
    const user = req.user;

    const updated = await User.findByIdAndUpdate(user._id, data, {
      new: true,
      select: fields, // Only returns _id, username, and lastLoggedIn
    }).lean();

    if (updated._id) delete updated._id;

    return res.status(200).json({
      message: "Account updated successfully",
      user: updated,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Update account error" });
  }
};

const addVehicle = async (req, res) => {
  try {
    const user = req.user;
    const { plate } = req.body;

    if (!plate) {
      return res.status(400).json({ message: "Plate number required" });
    }

    let imageUrl = null;

    if (req.file) {
      const result = await fileUploaderOnCloudinary(req.file.path);
      imageUrl = result.secure_url;
    }

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        $push: {
          vehicle: {
            plate,
            image: imageUrl,
          },
        },
      },
      { new: true }
    );

    return res.status(200).json({
      message: "Vehicle added",
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ message: "Add vehicle error" });
  }
};

const updateVehicle = async (req, res) => {
  try {
    const userId = req.user.id; // from auth middleware

    const { plate, model, color, type } = req.body;
    const image = req.file?.path; // if using multer

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.vehicle || user.vehicle.length === 0) {
      return res.status(400).json({
        message: "No vehicle found to update",
      });
    }

    const vehicle = user.vehicle[0];

    if (plate) vehicle.plate = plate;
    if (model) vehicle.model = model;
    if (color) vehicle.color = color;
    if (image) vehicle.image = image;

    await user.save();

    res.status(200).json({
      message: "Vehicle updated successfully",
      user,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "updateVehicle error" });
  }
};
module.exports = {
  updateAccount,
  addVehicle,
  updateVehicle,
};
