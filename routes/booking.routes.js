const express = require("express");
const router = express.Router();
const isAuthenticated = require("../middlewares/isAuthenticated");
const {
  createBooking,
  getAllBookings,
  cancelBooking,
  getOwnerBookings,
  getDriverBookings,
  ownerConfirmBooking,
} = require("../controllers/booking.controller");
// const hmac = require('../middleware/hmac'); // secure ANPR endpoints

router.post("/", isAuthenticated, createBooking);
router.patch("/:id/confirm", isAuthenticated, ownerConfirmBooking); // owner only - controller checks owner
router.delete("/:id/cancel", isAuthenticated, cancelBooking);
router.get("/:lotId/:status", isAuthenticated, getOwnerBookings);
// router.post('/anpr/entry', hmac, controller.handleAnprEntry);
// router.post('/anpr/exit', hmac, controller.handleAnprExit);
router.get("/:status", isAuthenticated, getDriverBookings);
router.get("/", isAuthenticated, getAllBookings);

module.exports = router;
