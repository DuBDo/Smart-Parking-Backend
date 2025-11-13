const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const setOtpMail = require("../utils/mail");

const signup = async (req, res) => {
  try {
    const { fullName, email, password, mobile } = req.body;

    if (!fullName || !email || !password || !mobile)
      return res.status(400).json({ message: "All fields are required" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      fullName,
      email,
      password: hashedPassword,
      mobile,
    });

    res.status(201).json({ message: "User created successfully", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, {
      expiresIn: "5h",
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User does not exists' });
    }

    const otp = (Math.floor(Math.random() * 9000) + 1000).toString();
    user.resetOtp = otp;
    user.otpExpires = Date.now() + 5 * 60 * 1000;
    user.isOtpVerified = false;
    await user.save();

    setOtpMail(email, otp);
    return res.status(200).json({ message: 'Otp sent successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Send OTP Error' });
  }
}

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    const user = await User.findOne({ email });
  
    if(!user){
      return res.status(404).json({message:'User not found'});
    }
    
    if (user.resetOtp !== otp) {
      return res.status(400).json({ message: 'OTP verification failed, please enter the authentic otp' })
    }
    if (user.otpExpires < Date.now()) {
      return res.status(400).json({ message: 'OTP already expired' })
    } 
      user.resetOtp = undefined;
      user.otpExpires = undefined;
      user.isOtpVerified = true;
      await user.save();

      return res.status(200).json({ message: 'OTP verified successfully' });
    
   } catch (error) {
      console.log(error);
      return res.status(500).json({ messsage: 'OTP verification Error' })
    }
}

const resetPassword = async(req, res)=>{
  try {
    const {email, newPassword} = req.body;

    console.log(email, newPassword)
    const user = await User.findOne({email});
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.save();
    
    return res.status(201).json({message: 'Password reset successfully'});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: 'Reset password error'})
  }
}
module.exports = {
  signup,
  login,
  sendOtp,
  verifyOtp,
  resetPassword
}