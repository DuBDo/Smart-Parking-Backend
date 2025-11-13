const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    mobile: {
      type: String,
      required: true,
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