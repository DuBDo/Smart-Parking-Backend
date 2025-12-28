const ParkingLot = require("../models/parkinglot.model");
const Booking = require("../models/booking.model");
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

const getOneParkingLot = async (req, res) => {
  try {
    const id = req.params.id;

    const parkingLot = await ParkingLot.findById(id);
    if (!parkingLot)
      return res.status(400).json({ message: "Parking lot not found" });

    return res.status(200).json(parkingLot);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "getOneParingLot error", error });
  }
};
const getParkingLot = async (req, res) => {
  try {
    const {
      lat,
      lon,
      bookingType,
      startTime,
      endTime,
      availability,
      startingOn,
      maxDistance = 2000, //in kms
    } = req.query;

    if (!lat || !lon) {
      return res
        .status(400)
        .json({ message: "Latitude and longitude required" });
    }
    const start = new Date(startTime);
    const end = new Date(endTime);

    // Find Nearest Parking Lots using $near
    const nearestLots = await ParkingLot.find({
      status: "approved",
      isOpen: true,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lon), parseFloat(lat)], // [longitude, latitude]
          },
          $maxDistance: parseInt(maxDistance),
        },
      },
      $or: [{ bookingType: "all" }, { bookingType: bookingType }],
    }).lean();

    //Filter for actual availability based on Bookings
    const availabilityResults = await Promise.all(
      nearestLots.map(async (lot) => {
        // Check for overlapping bookings in this specific lot during user's time
        const overlappingBookingsCount = await Booking.countDocuments({
          parkingLotId: lot._id,
          bookingStatus: { $in: ["confirmed", "active", "pending"] }, // only count valid bookings
          $or: [
            { startTime: { $lt: end }, endTime: { $gt: start } }, // The Overlap Formula
          ],
        });
        const slotsRemaining = lot.totalSlots - overlappingBookingsCount;

        if (slotsRemaining > 0) {
          // Calculate distance (MongoDB provides this if you use aggregate,
          // but for .find() we can return the lot)
          return {
            ...lot,
            availableSlotsCount: slotsRemaining,
            isAvailable: true,
          };
        }
        return null;
      })
    );
    // Remove nulls (lots that are full)
    const finalAvailableLots = availabilityResults.filter(
      (lot) => lot !== null
    );

    return res.status(200).json({
      success: true,
      count: finalAvailableLots.length,
      parkingLots: finalAvailableLots,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "getParkingLot error", error });
  }
};
module.exports = {
  listParkingLot,
  getOneParkingLot,
  getParkingLot,
};
