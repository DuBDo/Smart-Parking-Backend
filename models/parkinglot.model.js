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
    location: {
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

    totalBookings: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Optional: also track completed/cancelled for analytics
    completedBookings: { type: Number, default: 0 },

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
        rating: { type: Number, min: 1, max: 5 },
        comment: String,
      },
    ],
    totalRatings: {
      type: Number,
      min: 0,
    },
    avgRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
  },
  { timestamps: true }
);

ParkingLotSchema.index({ location: "2dsphere" });

// Virtual: Total number of ratings (read-only, always up-to-date)
ParkingLotSchema.virtual("totalRatingsCount").get(function () {
  return this.ratings ? this.ratings.length : 0;
});
// VIRTUAL: Always shows current average (even if avgRating field is outdated)
ParkingLotSchema.virtual("currentAvgRating").get(function () {
  if (!this.ratings || this.ratings.length === 0) return 0;

  const sum = this.ratings.reduce(
    (acc, rating) => acc + (rating.rating || 0),
    0
  );
  return Math.round((sum / this.ratings.length) * 100) / 100; // 2 decimal precision
});

// MIDDLEWARE: Auto-update avgRating field on save
ParkingLotSchema.pre("save", function (next) {
  // Only recalculate if ratings array changed
  if (this.isModified("ratings") || this.isNew()) {
    this.avgRating = this.currentAvgRating;
    this.totalRatings = this.ratings.length;
  }
  next();
});

// Ensure virtuals are included in JSON/API responses
ParkingLotSchema.set("toJSON", { virtuals: true });
ParkingLotSchema.set("toObject", { virtuals: true });

const ParkingLot = mongoose.model("ParkingLot", ParkingLotSchema);

module.exports = ParkingLot;
