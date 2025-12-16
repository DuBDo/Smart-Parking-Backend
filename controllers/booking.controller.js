// controllers/bookings.controller.js
const Booking = require("../models/booking.model");
const ParkingLot = require("../models/parkinglot.model");
const locker = require("../middlewares/locker");
const { sendRealtime } = require("../utils/realtime");

// Helper: round up to nearest 15-minute block
function roundUpToQuarterHourHours(ms) {
  const minutes = ms / (1000 * 60);
  const blocks = Math.ceil(minutes / 15); // number of 15-min blocks
  return blocks * 0.25; // hours (15min = 0.25 hour)
}

// Compute total using quarter-hour rounding
function computeTotalPrice(start, end, pricePerHour) {
  const ms = Math.max(0, new Date(end) - new Date(start));
  const hours = roundUpToQuarterHourHours(ms);
  return Number((hours * pricePerHour).toFixed(2));
}

// find overlapping bookings with statuses that occupy slots
async function findOverlappingCount(
  parkingLotId,
  start,
  end,
  statuses = ["pending", "confirmed", "active"]
) {
  return Booking.countDocuments({
    parkingLotId,
    bookingStatus: { $in: statuses },
    $or: [{ startTime: { $lt: end }, endTime: { $gt: start } }],
  });
}

// CREATE booking (driver)
exports.createBooking = async (req, res) => {
  try {
    const driverId = req.user._id;
    const { parkingLotId, fromTime, untilTime, vehiclePlate, vehicleType } =
      req.body;
    const startTime = JSON.parse(fromTime);
    const endTime = JSON.parse(untilTime);
    if (!parkingLotId || !startTime || !endTime || !vehiclePlate) {
      return res.status(400).json({
        message: "parkingLotId, startTime, endTime, vehiclePlate required",
      });
    }
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (now > start) {
      return res
        .status(400)
        .json({ message: "startTime must be before current time" });
    }
    if (start >= end)
      return res
        .status(400)
        .json({ message: "startTime must be before endTime" });

    const lot = await ParkingLot.findById(parkingLotId);
    if (!lot) return res.status(404).json({ message: "Parking lot not found" });

    // price calculation
    const pricePerHour = lot.pricePerHour;
    const totalPrice = computeTotalPrice(start, end, pricePerHour);

    // check capacity under lock to avoid race on heavy load (slotCount)
    const booking = await locker.withLock(
      `create:${parkingLotId}`,
      async () => {
        const occupied = await findOverlappingCount(parkingLotId, start, end, [
          "confirmed",
          "pending",
          "active",
        ]);
        const capacity = lot.totalSlots;
        if (occupied >= capacity) {
          return res.status(409).json({
            message: "Parking lot is full for the choosen time interval",
          });
        }

        const b = new Booking({
          driverId,
          parkingLotId,
          vehiclePlate,
          vehicleType,
          startTime: start,
          endTime: end,
          pricePerHour,
          totalPrice,
          bookingStatus: "pending-payment",
          // lot.autoApproval ? "confirmed" : "pending",
          status: "pending",
          paymentStatus: "pending",
          amountDue: totalPrice,
        });
        await b.save();

        // if autoApproved, reject pending overlaps right away
        if (lot.autoApproval) {
          // reject any pending overlapping bookings to lock the time frame
          const pendingOverlap = await Booking.find({
            parkingLotId,
            bookingStatus: "pending",
            $or: [{ startTime: { $lt: end }, endTime: { $gt: start } }],
          });
          for (const p of pendingOverlap) {
            if (String(p._id) !== String(b._id)) {
              p.bookingStatus = "rejected";
              await p.save();
              sendRealtime(
                req.app.get("io"),
                `user:${String(p.driverId)}`,
                "booking:rejected",
                p
              );
            }
          }
        }

        return b;
      }
    );

    // realtime notifications
    sendRealtime(
      req.app.get("io"),
      `user:${String(driverId)}`,
      "booking:created",
      booking
    );
    sendRealtime(
      req.app.get("io"),
      `owner:${String(parkingLotId)}`,
      "booking:created",
      booking
    );
    sendRealtime(req.app.get("io"), "map", "spot:bookingCreated", {
      parkingLotId,
      bookingId: booking._id,
    });

    return res.status(201).json(booking);
  } catch (err) {
    console.error("createBooking", err);
    return res.status(500).json({ message: "Create booking error" });
  }
};

// OWNER confirms booking (owner only) -> booking moves to confirmed and overlapping pending bookings are rejected
exports.ownerConfirmBooking = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const bookingId = req.params.id;

    const result = await locker.withLock(`confirm:${bookingId}`, async () => {
      const booking = await Booking.findById(bookingId);
      if (!booking) throw { status: 404, message: "Booking not found" };

      const lot = await ParkingLot.findById(booking.parkingLotId);
      if (!lot) throw { status: 404, message: "Parking lot not found" };
      if (String(lot.owner) !== String(ownerId))
        throw { status: 403, message: "Only owner can confirm" };

      if (lot.autoApproval)
        throw {
          status: 403,
          message:
            "Your parking lot is capable of auto-accepting the pending requests",
        };
      // capacity check
      const occupied = await findOverlappingCount(
        booking.parkingLotId,
        booking.startTime,
        booking.endTime,
        ["confirmed", "in-progress", "active"]
      );
      if (occupied >= (lot.totalSlots || 1)) {
        throw { status: 409, message: "Time slot not available (full)" };
      }

      booking.bookingStatus = "confirmed";
      await booking.save();

      // reject overlapping pending bookings only if the slot becomes full
      if (occupied == lot.totalSlots - 1) {
        const pendingOverlap = await Booking.find({
          parkingLotId: booking.parkingLotId,
          bookingStatus: "pending",
          $or: [
            {
              startTime: { $lt: booking.endTime },
              endTime: { $gt: booking.startTime },
            },
          ],
        });
        for (const p of pendingOverlap) {
          if (String(p._id) !== String(booking._id)) {
            p.bookingStatus = "rejected";
            await p.save();
            sendRealtime(
              req.app.get("io"),
              `user:${String(p.driverId)}`,
              "booking:rejected",
              p
            );
          }
        }
      }

      sendRealtime(
        req.app.get("io"),
        `owner:${String(lot._id)}`,
        "booking:confirmed",
        booking
      );
      sendRealtime(
        req.app.get("io"),
        `user:${String(booking.driverId)}`,
        "booking:confirmed",
        booking
      );
      sendRealtime(req.app.get("io"), "map", "spot:bookingConfirmed", {
        parkingLotId: booking.parkingLotId,
        bookingId: booking._id,
      });

      return booking;
    });

    return res.json(result);
  } catch (err) {
    console.error("ownerConfirmBooking", err);
    if (err && err.status)
      return res.status(err.status).json({ message: err.message });
    return res.status(500).json({ message: "Server error" });
  }
};

// CANCEL booking (driver or owner)
exports.cancelBooking = async (req, res) => {
  try {
    const userId = req.user._id;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const lot = await ParkingLot.findById(booking.parkingLotId);
    const isOwner = lot && String(lot.owner) === String(userId);
    const isDriver = String(booking.driverId) === String(userId);
    if (!isOwner && !isDriver)
      return res.status(403).json({
        message: "Forbidden!! Only owner or driver can reject/cancel bookings",
      });

    // if vehicle is inside, disallow cancel via this endpoint (must exit first)
    if (booking.isInside)
      return res
        .status(400)
        .json({ message: "Cannot cancel while vehicle is inside" });
    if (isOwner) {
      booking.bookingStatus = "rejected";
      booking.status = "past";
      await booking.save();

      sendRealtime(
        req.app.get("io"),
        `owner:${String(booking.parkingLotId)}`,
        "booking:rejected",
        booking
      );
      sendRealtime(
        req.app.get("io"),
        `user:${String(booking.driverId)}`,
        "booking:rejected",
        booking
      );
      sendRealtime(req.app.get("io"), "map", "spot:bookingRejected", {
        parkingLotId: booking.parkingLotId,
        bookingId: booking._id,
      });
    } else {
      booking.bookingStatus = "cancelled";
      booking.status = "past";
      await booking.save();

      sendRealtime(
        req.app.get("io"),
        `owner:${String(booking.parkingLotId)}`,
        "booking:cancelled",
        booking
      );
      sendRealtime(
        req.app.get("io"),
        `user:${String(booking.driverId)}`,
        "booking:cancelled",
        booking
      );
      sendRealtime(req.app.get("io"), "map", "spot:bookingCancelled", {
        parkingLotId: booking.parkingLotId,
        bookingId: booking._id,
      });
    }

    return res.json(booking);
  } catch (err) {
    console.error("cancelBooking", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getOwnerBookings = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { status, lotId } = req.params;
    const { limit = 10, skip = 0 } = req.query;
    let options = {
      parkingLotId: lotId,
      status,
    };

    const lot = await ParkingLot.findById(lotId);
    if (!lot) throw { status: 404, message: "Parking lot not found" };

    if (String(lot.owner) !== String(ownerId))
      throw { status: 403, message: "You are not the owner of this lot" };

    const totalCounts = await Booking.countDocuments(options);
    const totalPages = Math.ceil(totalCounts / limit);

    const bookings = await Booking.find(options)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate({
        path: "driverId",
        select: "-password",
      })
      .populate({
        path: "parkingLotId",
      });

    return res.status(200).json({
      success: true,
      bookings,
      counts: totalCounts,
      pages: totalPages,
    });
  } catch (error) {
    console.log("getOwnerBookings error", error);
    return res
      .status(500)
      .json({ success: false, message: "getOwnerBookings error" });
  }
};
// ANPR entry — secure webhook from Pi; marks booking active and sets gateEntryTime
exports.handleAnprEntry = async (req, res) => {
  try {
    const { parkingLotId, plate, timestamp } = req.body;
    const time = timestamp ? new Date(timestamp) : new Date();
    const now = new Date();

    // find best matching booking: prefer 'confirmed' whose startTime <= now + earlyTolerance
    const earlyToleranceMs = 15 * 60 * 1000; // allow 15 min early
    const match = await Booking.findOne({
      parkingLotId,
      vehiclePlate: plate,
      bookingStatus: { $in: ["confirmed", "in-progress", "upcoming"] },
      startTime: { $lte: new Date(now.getTime() + earlyToleranceMs) },
      endTime: { $gte: now }, // not ended
    }).sort({ startTime: 1 });

    if (!match) {
      // No booking found: reject or treat as walk-in per business rules
      return res.status(404).json({ message: "No matching booking found" });
    }

    // mark active
    match.isInside = true;
    match.gateEntryTime = time;
    match.bookingStatus = "active";
    await match.save();

    sendRealtime(
      req.app.get("io"),
      `owner:${String(parkingLotId)}`,
      "booking:entered",
      match
    );
    sendRealtime(
      req.app.get("io"),
      `user:${String(match.driverId)}`,
      "booking:entered",
      match
    );
    sendRealtime(req.app.get("io"), "map", "spot:entered", {
      parkingLotId,
      bookingId: match._id,
    });

    return res.json({ ok: true, bookingId: match._id });
  } catch (err) {
    console.error("handleAnprEntry", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ANPR exit — compute final charges, mark completed and return amountDue
exports.handleAnprExit = async (req, res) => {
  try {
    const { parkingLotId, plate, timestamp } = req.body;
    const time = timestamp ? new Date(timestamp) : new Date();

    const match = await Booking.findOne({
      parkingLotId,
      vehiclePlate: plate,
      isInside: true,
      bookingStatus: { $in: ["active", "in-progress", "confirmed"] },
    }).sort({ startTime: -1 });

    if (!match) {
      return res
        .status(404)
        .json({ message: "No active booking found for this plate" });
    }

    match.isInside = false;
    match.gateExitTime = time;

    // compute extra time beyond endTime in quarter-hour blocks
    const end = new Date(match.endTime);
    let extra = 0;
    if (time > end) {
      const extraMs = time - end;
      const extraHours = roundUpToQuarterHourHours(extraMs);
      extra = Number((extraHours * match.pricePerHour).toFixed(2));
    }
    match.extraCharges = extra;
    match.amountDue = Number((match.totalPrice + extra).toFixed(2));
    // For post-pay, paymentStatus remains pending until driver pays. We mark completed.
    match.paymentStatus = match.paymentStatus === "paid" ? "paid" : "pending";
    match.bookingStatus = "completed";
    await match.save();

    sendRealtime(
      req.app.get("io"),
      `owner:${String(parkingLotId)}`,
      "booking:exited",
      match
    );
    sendRealtime(
      req.app.get("io"),
      `user:${String(match.driverId)}`,
      "booking:exited",
      match
    );
    sendRealtime(req.app.get("io"), "map", "spot:exited", {
      parkingLotId,
      bookingId: match._id,
    });

    return res.json({
      ok: true,
      bookingId: match._id,
      amountDue: match.amountDue,
    });
  } catch (err) {
    console.error("handleAnprExit", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Get grouped bookings for user: upcoming, inProgress, past (completed + cancelled)
// exports.getUserBookingGroups = async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const now = new Date();
//     // upcoming: confirmed and startTime > now
//     const upcoming = await Booking.find({
//       driverId: userId,
//       bookingStatus: { $in: ["confirmed", "pending", "upcoming"] },
//       startTime: { $gt: now },
//     })
//       .sort({ startTime: 1 })
//       .populate("parkingLotId");
//     // in-progress: between start and end, and statuses confirmed/in-progress/active
//     const inProgress = await Booking.find({
//       driverId: userId,
//       bookingStatus: { $in: ["confirmed", "in-progress", "active"] },
//       startTime: { $lte: now },
//       endTime: { $gte: now },
//     })
//       .sort({ startTime: 1 })
//       .populate("parkingLotId");

//     // past: completed or cancelled
//     const past = await Booking.find({
//       driverId: userId,
//       bookingStatus: { $in: ["completed", "cancelled"] },
//     })
//       .sort({ endTime: -1 })
//       .populate("parkingLotId");

//     return res.json({ upcoming, inProgress, past });
//   } catch (err) {
//     console.error("getUserBookingGroups", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

exports.getDriverBookings = async (req, res) => {
  try {
    const driverId = req.user._id;
    const status = req.params.status;
    const { limit = 10, skip = 0, q = "" } = req.query;

    const query = {
      driverId,
      status,
    };
    if (q.trim() !== "") {
      const matchingLots = await ParkingLot.find({
        $or: [
          { address: { $regex: q, $options: "i" } },
          { name: { $regex: q, $options: "i" } },
        ],
      }).select("_id");
      if (matchingLots) {
        const parkingLotIds = matchingLots.map((lot) => lot._id);
        query.parkingLotId = { $in: parkingLotIds };
      }
    }
    const totalCount = await Booking.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);
    const bookings = await Booking.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate({
        path: "driverId",
        select: "-password",
      })
      .populate({
        path: "parkingLotId",
      });
    return res.status(200).json({
      success: true,
      bookings,
      counts: totalCount,
      pages: totalPages,
    });
  } catch (error) {
    console.log("getInProgress booking error", error);
    return res
      .status(500)
      .json({ success: false, message: "getInProgress error" });
  }
};
exports.getAllBookings = async (req, res) => {
  try {
    const driverId = req.user._id; // from auth middleware
    const bookings = await Booking.find({ driverId });

    return res.status(200).json(bookings);
  } catch (err) {
    console.error("Get bookings error:", err);
    return res
      .status(500)
      .json({ success: false, message: "getBookings error" });
  }
};
