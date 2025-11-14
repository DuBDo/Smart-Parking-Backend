const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
    },
    googleId: {
      type: String,
    },
    isVerified:{
      type: Boolean,
      default: false
    },
    isLoggedIn: {
      type: Boolean,
      default: false
    },
    mobile: {
      type: String
    },
    role: {
      type: String,
      enum: ["driver", "owner", "admin"],
      default: "driver",
    },
    resetOtp:{
      type: String
    },
    isOtpVerified:{
      type: Boolean,
      defauult:false
    },
    otpExpires:{
      type:Date,
      
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);