const mongoose = require("mongoose");

const ChatRoomSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
      index: { sparse: true },
    },
    parlingLotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingLot",
    },
    lastMessage: {
      text: String,
      senderId: mongoose.Schema.Types.ObjectId,
      createdAt: Date,
    },
    lastMessageAt: Date,
    isRead: {
      type: Boolean,
      default: false,
    },
    unreadCount: {
      driver: { type: Number, default: 0 },
      owner: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ["enquiry", "booked", "closed"],
      default: "enquiry",
    },
  },

  { timestamps: true }
);

ChatRoomSchema.index({ updatedAt: -1 });

module.exports = mongoose.model("ChatRoom", ChatRoomSchema);
