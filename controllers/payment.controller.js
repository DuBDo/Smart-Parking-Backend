const { v4: uuidv4 } = require("uuid");
const Payment = require("../models/payment.model");
const Booking = require("../models/booking.model");
const ParkingLot = require("../models/parkinglot.model");
const { generateSignature } = require("../utils/esewaSignature");
const axios = require("axios");
const { khaltiInitiate } = require("../utils/khalti.utils");

const initiateEsewaPayment = async (req, res) => {
  const { bookingId, amount } = req.body;

  const transactionUuid = uuidv4();

  await Payment.create({
    bookingId,
    amount,
    transactionUuid,
    gateway: "ESEWA",
  });

  const payload = {
    amount,
    tax_amount: 0,
    total_amount: amount,
    transaction_uuid: transactionUuid,
    product_code: process.env.ESEWA_MERCHANT_CODE,
    product_service_charge: 0,
    product_delivery_charge: 0,
    success_url: `${process.env.BACKEND_BASE_URL}/api/V1/payment/esewa/success`,
    failure_url: `${process.env.BACKEND_BASE_URL}/api/V1/payment/esewa/failure`,
    signed_field_names: "total_amount,transaction_uuid,product_code",
  };

  payload.signature = generateSignature(
    payload,
    process.env.ESEWA_SECRET_KEY,
    "initiator"
  );

  console.log(payload.signature);
  res.json({
    paymentUrl: process.env.ESEWA_PAYMENT_URL,
    payload,
  });
};

const esewaSuccess = async (req, res) => {
  try {
    const { data } = req.query;

    const decoded = JSON.parse(Buffer.from(data, "base64").toString("utf-8"));

    const {
      transaction_code,
      status,
      total_amount,
      transaction_uuid,
      product_code,
      signed_field_names,
      signature,
    } = decoded;

    // 1️⃣ Signature verification
    const expectedSignature = generateSignature(
      {
        transaction_code,
        status,
        total_amount,
        transaction_uuid,
        product_code,
        signed_field_names,
      },
      process.env.ESEWA_SECRET_KEY,
      "tokenVerify"
    );

    if (expectedSignature !== signature) {
      return res.status(400).send("Signature mismatch");
    }

    const payment = await Payment.findOne({
      transactionUuid: transaction_uuid,
    });

    if (!payment) {
      return res.status(404).send("Payment not found");
    }

    // 2️⃣ Idempotency check
    if (payment.status === "PAID") {
      return res.redirect("/payment-success");
    }

    // 3️⃣ Verify with eSewa server
    const verificationUrl = `${process.env.ESEWA_STATUS_URL}?product_code=${product_code}&total_amount=${total_amount}&transaction_uuid=${transaction_uuid}`;

    const { data: esewaStatus } = await axios.get(verificationUrl);
    if (esewaStatus.status !== "COMPLETE") {
      return res.redirect("/payment-failed");
    }

    // 4️⃣ Update payment + booking atomically
    const booking = await Booking.findById(payment.bookingId);
    const parkingLot = await ParkingLot.findById(booking.parkingLotId);
    await Payment.updateOne(
      { transactionUuid: transaction_uuid },
      {
        parkingLotId: parkingLot._id,
        status: "paid",
        rawResponse: decoded,
        verifiedAt: new Date(),
      }
    );

    booking.bookingStatus = "confirmed";
    await booking.save();

    res.redirect(
      `${process.env.CLIENT_URL}/dashboard/bookings-made?status=success`
    );
  } catch (err) {
    console.error(err);
    res.redirect(
      `${process.env.CLIENT_URL}/dashboard/bookings-made?status=failed`
    );
  }
};

const esewaFailure = async (req, res) => {
  const { transaction_uuid } = req.query;

  await Payment.findOneAndUpdate(
    { transactionUuid: transaction_uuid },
    { status: "failed" }
  );

  res.redirect(
    `${process.env.CLIENT_URL}/dashboard/bookings-made?status=failed`
  );
};

// for khalti

/**
 * STEP 1: Initiate payment
 */
const initiateKhaltiPayment = async (req, res) => {
  const { bookingId } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) return res.status(404).json({ message: "Booking not found" });

  if (booking.paymentStatus === "paid") {
    return res.status(400).json({ message: "Already paid" });
  }

  const khaltiRes = await khaltiInitiate({
    amount: booking.totalPrice * 100, // paisa
    purchaseOrderId: bookingId,
    purchaseOrderName: "Parking Booking",
    customer: {
      name: req.user.firstName,
      email: req.user.email,
      phone: req.user.mobile,
    },
  });

  // Save payment attempt
  await Payment.create({
    bookingId: booking._id,
    gateway: "KHALTI",
    pidx: khaltiRes.pidx,
    status: "pending",
    rawKhaltiInitiateResponse: khaltiRes,
  });

  res.json({
    payment_url: khaltiRes.payment_url,
  });
};

/**
 * STEP 2: Khalti redirect (SUCCESS)
 */
const khaltiSuccess = async (req, res) => {
  const { pidx } = req.query;

  // VERIFY payment
  const verifyRes = await axios.post(
    "https://dev.khalti.com/api/v2/epayment/lookup/",
    { pidx },
    {
      headers: {
        Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  // Save raw verify response
  const payment = await Payment.findOne({ pidx });
  payment.rawKhaltiVerifyResponse = verifyRes.data;

  if (verifyRes.data.status === "Completed") {
    payment.status = "paid";
    await payment.save();

    // MARK BOOKING PAID + LOCK SLOT
    const booking = await Booking.findById(payment.bookingId);
    booking.bookingStatus = "confirmed";
    booking.paymentStatus = "paid";
    // booking.isSlotLocked = true;
    await booking.save();

    return res.redirect(
      `${process.env.CLIENT_URL}/dashboard/bookings-made?status=success`
    );
  }

  payment.status = "FAILED";
  await payment.save();

  `${process.env.CLIENT_URL}/dashboard/bookings-made?status=failed`;
};

// const khaltiClient = require("../utils/khalti.utils");

// const initiateKhaltiPayment = async (req, res) => {
//   const { bookingId, amount } = req.body;
//   const transactionUuid = uuidv4();

//   const payment = await Payment.create({
//     bookingId,
//     amount,
//     transactionUuid,
//     status: "pending",
//     gateway: "KHALTI",
//   });

//   const payload = {
//     return_url: `${process.env.BACKEND_BASE_URL}/api/V1/payment/khalti/success`,
//     website_url: "http://localhost:5173",
//     amount: amount * 100, // paisa
//     purchase_order_id: transactionUuid,
//     purchase_order_name: "Parking Booking",
//   };

//   const { data } = await khaltiClient.post("initiate/", payload);

//   await Payment.findByIdAndUpdate(payment._id, {
//     pidx: data.pidx,
//   });

//   res.json({
//     pidx: data.pidx,
//     payment_url: data.payment_url,
//   });
// };

// const verifyKhaltiPayment = async (req, res) => {
//   const { pidx } = req.body;

//   const payment = await Payment.findOne({ pidx });

//   if (!payment) {
//     return res.status(404).json({ message: "Payment not found" });
//   }

//   // Idempotency
//   if (payment.status === "paid") {
//     return res.json({ status: "already_verified" });
//   }

//   const { data } = await khaltiClient.post("lookup/", { pidx });

//   if (data.status !== "Completed") {
//     return res.status(400).json({ status: "failed" });
//   }

//   await Payment.updateOne(
//     { pidx },
//     {
//       status: "paid",
//       rawResponse: data,
//       verifiedAt: new Date(),
//     }
//   );

//   // Confirm booking
//   await Booking.findByIdAndUpdate(payment.bookingId, {
//     bookingStatus: "confirmed",
//   });

//   res.json({ status: "success" });
// };

module.exports = {
  initiateEsewaPayment,
  esewaSuccess,
  esewaFailure,
  initiateKhaltiPayment,
  khaltiSuccess,
};
