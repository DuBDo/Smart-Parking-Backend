const express = require("express");
const { signup, login, sendOtp, verifyOtp, resetPassword } = require("../controllers/auth.controller");
const authRouter = express.Router();

authRouter.post("/signup", signup);
authRouter.post("/login", login);
authRouter.post('/send-otp', sendOtp);
authRouter.post('/verify-otp', verifyOtp);
authRouter.post('/reset-password', resetPassword);

module.exports = authRouter;