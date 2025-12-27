const express = require("express");
const {
  sendMessage,
  getChatsByTab,
  getMessages,
  markAsRead,
  attachBooking,
  markCompleted,
} = require("../controllers/message.controller.js");

const router = express.Router();

router.post("/send", sendMessage);
router.get("/list", getChatsByTab);
router.get("/messages/:chatRoomId", getMessages);
router.post("/read", markAsRead);
router.post("/attach-booking", attachBooking);
router.post("/complete", markCompleted);

module.exports = router;
