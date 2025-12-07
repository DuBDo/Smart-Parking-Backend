const ParkingLot = require("../models/parkinglot.model");
const User = require("../models/user.model");
const fileUploaderOnCloudinary = require("../utils/cloudinary");

const listParkingLot = async (req, res) => {
  try {
    const {
      name,
      postCode,
      parkType,
      count,
      size,
      ev,
      address,
      hourly,
      daily,
      phone,
      description,
      features,
      autoApproval,
    } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }
    const files = req.files; // ARRAY of images

    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No photos uploaded" });
    }

    const urls = [];
    for (const file of files) {
      const result = await fileUploaderOnCloudinary(file.path);
      urls.push(result.secure_url);
    }
    const parkingListed = await ParkingLot.create({
      name,
      postCode,
      owner: user._id,
      parkType,
      totalSlots: count,
      size,
      evCharger: ev,
      address,
      pricePerHour: hourly,
      pricePerDay: daily,
      phone,
      description,
      features: Array.isArray(features) ? features : features.split(","),
      images: urls,
      autoApproval,
      status: "pending",
    });

    user.role = "owner";
    user.mobile = phone;
    await user.save();

    return res.status(201).json({
      message: "Parking listed successfully",
      user,
      parkingListed,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "List parking-lot error", error });
  }
};

const getParkingLot = async (req, res) => {
  try {
    const parkingLots = await ParkingLot.find();

    return res.status(200).json(parkingLots);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "List parking-lot error", error });
  }
};
module.exports = {
  listParkingLot,
  getParkingLot,
};
