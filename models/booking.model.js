// models/booking.model.js
const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    parkingLotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingLot",
      required: true,
    },

    slotNumber: { type: Number }, // optional

    vehiclePlate: { type: String, required: true },

    bookingType: {
      type: String,
      enum: ["hourly/daily", "monthly"],
      required: true,
    },

    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },

    pricePerHour: { type: Number, required: true },
    totalPrice: { type: Number, required: true },

    // lifecycle
    bookingStatus: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "active",
        "completed",
        "cancelled",
        "rejected",
        "expired",
      ],
      default: "pending",
    },

    //frontendStatuses
    status: {
      type: String,
      enum: ["in-progress", "upcoming", "past", "pending"],
      default: "pending",
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "not-paid", "paid", "failed", "refunded"],
      default: "not-paid",
    },

    // gate / ANPR
    isInside: { type: Boolean, default: false },
    gateEntryTime: { type: Date },
    gateExitTime: { type: Date },

    // overstay and final accounting
    extraCharges: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },

    holdExpiresAt: { type: Date }, // optional TTL for hold
  },
  { timestamps: true }
);

// bookingSchema.methods.setAmountDue = function(){
//   return this.pricePerHour
// }

bookingSchema.index({ parkingLotId: 1, startTime: 1, endTime: 1 });
bookingSchema.index({ driverId: 1, createdAt: -1 });

module.exports = mongoose.model("Booking", bookingSchema);
