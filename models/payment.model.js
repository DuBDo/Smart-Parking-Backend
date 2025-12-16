// models/payment.model.js
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    parkingLotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingLot",
    },
    amount: Number,
    transactionUuid: String,
    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    gateway: {
      type: String,
      enum: ["ESEWA", "KHALTI"],
      default: "ESEWA",
    },
    rawResponse: Object,
    verifiedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
