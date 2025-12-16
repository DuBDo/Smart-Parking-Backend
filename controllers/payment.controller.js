const { v4: uuidv4 } = require("uuid");
const Payment = require("../models/payment.model");
const Booking = require("../models/booking.model");
const ParkingLot = require("../models/parkinglot.model");
const { generateSignature } = require("../utils/esewaSignature");
const axios = require("axios");

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
    let bookingStatus;
    if (parkingLot.autoApproval == true) {
      bookingStatus = "confirmed";
    } else {
      (bookingStatus = "pending"), (booking.status = "pending");
    }
    booking.bookingStatus = bookingStatus;

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

module.exports = {
  initiateEsewaPayment,
  esewaSuccess,
  esewaFailure,
};
