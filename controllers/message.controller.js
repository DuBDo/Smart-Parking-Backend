const ChatRoom = require("../models/chatRoom.model.js");
const Message = require("../models/message.model.js");

/**
 * SEND MESSAGE
 * - Works for enquiry, booked, completed
 */

const sendMessage = async (req, res) => {
  const io = req.app.get("io");

  const { senderId, receiverId, text, bookingId } = req.body;

  let chatRoom = await ChatRoom.findOne({
    driver: { $in: [senderId, receiverId] },
    owner: { $in: [senderId, receiverId] },
    bookingId: bookingId || null,
  });
  if (!chatRoom) {
    chatRoom = await ChatRoom.create({
      driver: senderId,
      owner: receiverId,
      bookingId: bookingId || null,
      status: bookingId ? "booked" : "enquiry",
    });
  }

  const message = await Message.create({
    chatRoom: chatRoom._id,
    sender: senderId,
    receiver: receiverId,
    text,
  });

  chatRoom.lastMessageAt = new Date();
  await chatRoom.save();

  // io.to(`chat:${chatRoom._id}`).emit("new-message", {
  //   chatRoomId: chatRoom._id,
  //   message,
  // });

  res.status(201).json(message);
};

/**
 * GET CHAT LIST BY TAB
 */
const getChatsByTab = async (req, res) => {
  const { userId, tab } = req.query;

  const filter = {
    $or: [{ driver: userId }, { owner: userId }],
  };
  console.log(userId, typeof userId);

  if (tab === "enquiries") filter.status = "enquiry";
  if (tab === "booked") filter.status = "booked";
  if (tab === "past") filter.status = "completed";

  const chats = await ChatRoom.find(filter)
    .populate([
      { path: "driver" },
      { path: "owner" },
      {
        path: "bookingId",
        populate: {
          path: "parkingLotId",
          select: "name location address", // Only get these from ParkingLot
        },
      },
    ])
    .populate("bookingId.parkingLotId")
    .sort({ lastMessageAt: -1 });

  res.json(chats);
};

/**
 * GET MESSAGES
 */
const getMessages = async (req, res) => {
  const { chatRoomId } = req.params;

  const messages = await Message.find({ chatRoom: chatRoomId }).sort({
    createdAt: 1,
  });

  res.json(messages);
};

/**
 * MARK AS READ
 */
const markAsRead = async (req, res) => {
  const { chatRoomId, userId } = req.body;

  await Message.updateMany(
    {
      chatRoom: chatRoomId,
      receiver: userId,
      readAt: null,
    },
    { $set: { readAt: new Date() } }
  );

  res.json({ success: true });
};

/**
 * ATTACH BOOKING TO ENQUIRY CHAT
 */
const attachBooking = async (req, res) => {
  const { chatRoomId, bookingId } = req.body;

  const chat = await ChatRoom.findById(chatRoomId);
  chat.bookingId = bookingId;
  chat.status = "booked";

  await chat.save();

  res.json(chat);
};

/**
 * MARK BOOKING COMPLETED
 * Chat remains writable
 */
const markCompleted = async (req, res) => {
  const { chatRoomId } = req.body;

  const chat = await ChatRoom.findById(chatRoomId);
  chat.status = "completed";

  await chat.save();

  res.json(chat);
};

module.exports = {
  sendMessage,
  getChatsByTab,
  getMessages,
  markAsRead,
  attachBooking,
  markCompleted,
};
