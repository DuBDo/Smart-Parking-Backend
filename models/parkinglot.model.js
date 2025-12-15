const mongoose = require("mongoose");

const ParkingLotSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    postCode: Number,

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    description: String,

    parkType: {
      type: String,
      enum: ["Driveway", "Car-park", "Garage"],
      default: "Driveway",
    },
    bookingType: {
      type: String,
      enum: ["hourly/daily", "monthly", "all"],
      default: "all",
    },
    // for monthly plans

    // only for monthly and all bookingType
    monthlyPrice: Number,

    // cuz normal user need to pay before leaving the parking lot,
    firstPayment: {
      type: String,
      enum: [
        "on-starting-day",
        "before-end-of-the-month",
        "within-first-week",
        "within-15-days",
      ],
      default: "on-starting-day",
    },

    size: {
      type: String,
      enum: ["Small", "Medium", "Large"],
      default: "Small",
    },
    phone: {
      type: String,
      required: true,
    },
    images: {
      type: [String],
      default: [],
    },
    //ev charger
    evCharger: {
      type: Boolean,
      default: false,
    },
    // Address Info
    address: {
      type: String,
    },

    // GeoJSON for map
    /*location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },
    */
    // AutoAproval, true for organizations, false for individual,
    autoApproval: { type: Boolean, default: false },

    //status for admin to verify the listed parking lot
    status: {
      type: String,
      enum: ["pending", "approved", "not-approved"],
      default: "pending",
    },
    // Slots
    totalSlots: { type: Number, required: true },
    availableSlots: { type: Number, default: 0 },

    slotTypes: [
      {
        type: {
          type: String, // "car", "bike", "ev", "vip"
        },
        count: Number,
        pricePerHour: Number,
      },
    ],
    pricePerHour: Number,
    pricePerDay: Number,

    // Timings
    openingTime: String, // "08:00"
    closingTime: String, // "21:00"

    isOpen: { type: Boolean, default: true },
    features: [
      {
        type: String,
      },
    ],
    // System Settings
    autoEntry: { type: Boolean, default: false },
    autoExit: { type: Boolean, default: false },
    paymentMode: {
      type: String,
      enum: ["cash", "online", "both"],
      default: "both",
    },
    // Hardware
    anprCameraId: { type: String },
    gateControllerId: { type: String },

    // Reviews
    ratings: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        rating: Number,
        comment: String,
      },
    ],
  },
  { timestamps: true }
);

// ParkingLotSchema.index({ location: "2dsphere" });

const ParkingLot = mongoose.model("ParkingLot", ParkingLotSchema);

module.exports = ParkingLot;
