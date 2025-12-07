const express = require("express");
const router = express.Router();
const isAuthenticated = require("../middlewares/isAuthenticated");
const {
  createBooking,
  getUserBookingGroups,
  getBookings,
  getAllBookings,
  cancelBooking,
} = require("../controllers/booking.controller");
// const hmac = require('../middleware/hmac'); // secure ANPR endpoints

router.post("/", isAuthenticated, createBooking);
// router.post('/:id/confirm', requireAuth, controller.ownerConfirmBooking); // owner only - controller checks owner
router.delete("/:id/cancel", isAuthenticated, cancelBooking);

// router.post('/anpr/entry', hmac, controller.handleAnprEntry);
// router.post('/anpr/exit', hmac, controller.handleAnprExit);
router.get("/:status", isAuthenticated, getBookings);
router.get("/", isAuthenticated, getAllBookings);
// router.get("/user/groups", isAuthenticated, getUserBookingGroups);

module.exports = router;
