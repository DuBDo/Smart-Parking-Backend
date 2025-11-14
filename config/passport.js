let GoogleStrategy = require('passport-google-oauth20').Strategy;
const passport = require('passport');
const User = require('../models/user.model');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:8000/api/V1/auth/google/callback"
},
    async (accessToken, refreshToken, profile, cb) => {
        try {
            let user = await User.findOne({ googleId: profile.id });
            if(!user){
                const user = await User.create({
                    googleId : profile.id,
                    fullName : profile.displayName,
                    email: profile.emails[0].value,
                    isLoggedIn: true,
                    isVerified: true
                })
            }
            return cb(null, user);
        } catch (error) {
            return cb(error, null);
        }
    }
));