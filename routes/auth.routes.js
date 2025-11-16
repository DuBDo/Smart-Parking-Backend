const express = require("express");
const { signup, login, sendOtp, verifyOtp, resetPassword } = require("../controllers/auth.controller");
const passport = require("passport");
const authRouter = express.Router();
const jwt = require('jsonwebtoken');
const isAuthenticated = require('../middlewares/isAuthenticated');

// Google authentication 
authRouter.get('/google', passport.authenticate('google', {scope:['openid', 'profile', 'email']}));
authRouter.get('/google/callback',
    passport.authenticate('google', {session: false}),
    (req, res) =>{
        try{
            const token = jwt.sign({id: req.user._id}, process.env.JWT_SECRET_KEY,
                {
                    expiresIn:'5h'
                }
            );
            res.redirect(`${process.env.CLIENT_URL}/auth-success?token=${token}`);
        } catch (error){
            console.log('Google login error', error);
            res.redirect(`${process.env.CLIENT_URL}?error=google_login_failed`);
        }
    }
)
authRouter.get('/me', isAuthenticated, (req, res)=>{
    res.json({success: true, user: req.user});
})
authRouter.post("/signup", signup);
authRouter.post("/login", login);
authRouter.post('/send-otp', sendOtp);
authRouter.post('/verify-otp', verifyOtp);
authRouter.post('/reset-password', resetPassword);

module.exports = authRouter;