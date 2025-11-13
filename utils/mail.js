const nodemailer = require("nodemailer");
require('dotenv').config();

// Create a test account or replace with real credentials.
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.APP_PASSWORD,
  },
});

const setOtpMail = async(to, otp)=>{
    await transporter.sendMail({
        from: process.env.EMAIL,
        to,
        subject: 'Smart Park Otp Verification',
        html: `<p>Smart Park reset password OTP is <b>${otp}</b>. <p>Your OTP expires in 5 minutes<p/><p/>`
    })
}

module.exports = setOtpMail;