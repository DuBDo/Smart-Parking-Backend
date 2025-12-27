const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    chatRoom: { type: mongoose.Schema.Types.ObjectId, ref: "ChatRoom" },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    // status: {
    //   type: String,
    //   enum: ["sent", "delivered", "seen"],
    //   default: "sent",
    // },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ chatRoomId: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
