const cron = require("node-cron");
const Booking = require("../models/booking.model");

const calculateOverstayCharge = (endTime, now, ratePer15) => {
  if (now <= endTime)
    return { extraMinutes: 0, extraBlocks: 0, extraCharge: 0 };

  const diffMs = now - endTime;
  const extraMinutes = Math.ceil(diffMs / 60000);

  const extraBlocks = Math.ceil(extraMinutes / 15);
  const extraCharge = extraBlocks * ratePer15;

  return { extraMinutes, extraBlocks, extraCharge };
};

module.exports = function startBookingWorker(io) {
  // runs every minute
  cron.schedule("* * * * *", async () => {
    const now = new Date();

    try {
      // 1) Move confirmed -> in-progress when startTime <= now < endTime
      // also peaymentStatus must be paid before leaving the lot
      const toInProgress = await Booking.find({
        bookingStatus: { $in: ["confirmed"] },
        startTime: { $lte: now },
        endTime: { $gte: now },
      });
      for (const b of toInProgress) {
        if (!b.isInside) {
          b.status = "in-progress";
          await b.save();
          io?.to(`user:${b.driverId}`).emit("booking:inProgress", b);
          io?.to(`owner:${b.parkingLotId}`).emit("booking:inProgress", b);
          io?.to("map").emit("spot:inProgress", {
            parkingLotId: b.parkingLotId,
            bookingId: b._id,
          });
        } else {
          b.bookingStatus = "active";
          await b.save();
        }
      }

      // 1) Move confirmed -> upcoming when startTime > now
      // also peaymentStatus must be paid before leaving the lot
      const toUpcoming = await Booking.find({
        bookingStatus: { $in: ["confirmed"] },
        startTime: { $gte: now },
      });
      for (const b of toUpcoming) {
        b.status = "upcoming";
        await b.save();
        io?.to(`user:${b.driverId}`).emit("booking:upcoming", b);
        io?.to(`owner:${b.parkingLotId}`).emit("booking:upcoming", b);
        io?.to("map").emit("spot:upcoming", {
          parkingLotId: b.parkingLotId,
          bookingId: b._id,
        });
      }

      // 2) Auto-cancel no-shows: in-progress & now > startTime + 15min & not inside
      const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);
      const noShows = await Booking.find({
        status: "in-progress",
        startTime: { $lte: fifteenMinAgo },
        isInside: false,
      });
      for (const n of noShows) {
        n.bookingStatus = "expired";
        n.status = "past";
        await n.save();
        io?.to(`user:${n.driverId}`).emit("booking:autoCancelled", n);
        io?.to(`owner:${n.parkingLotId}`).emit("booking:autoCancelled", n);
        io?.to("map").emit("spot:noShowCancelled", {
          parkingLotId: n.parkingLotId,
          bookingId: n._id,
        });
      }

      // 3) Auto-complete active bookings whose endTime <= now and not inside (completed)
      const toComplete = await Booking.find({
        // bookingStatus: "active",
        endTime: { $lte: now },
        // paymentStatus: "paid",
      });
      for (const b of toComplete) {
        if (!b.isInside) {
          b.bookingStatus = "completed";
          b.status = "past";
          await b.save();
          io?.to(`user:${b.driverId}`).emit("booking:completed", b);
          io?.to(`owner:${b.parkingLotId}`).emit("booking:completed", b);
          io?.to("map").emit("spot:completed", {
            parkingLotId: b.parkingLotId,
            bookingId: b._id,
          });
        } else {
          const ratePer15 = b.pricePerHour / 4;
          const { extraMinutes, extraBlocks, extraCharge } =
            calculateOverstayCharge(b.endTime, now, ratePer15);

          // update booking in DB
          b.extraCharges = extraCharge;
          b.amountDue = amountDue + extraCharge;
          b.updatedAt = now;

          await b.save();
          // vehicle still inside past endTime: notify owner (overstay)
          io?.to(`owner:${b.parkingLotId}`).emit("booking:overstay", b);
        }
      }
    } catch (err) {
      console.error("booking worker error", err);
    }
  });
};
