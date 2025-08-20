const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User"); // apne project ke path ke hisaab se update karna

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Pehle email check karo (taake agar user normal signup se bana tha to bhi link ho jaye)
        let user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          // agar user hai lekin Google ID nahi hai (normal signup ki wajah se)
          if (!user.googleId) {
            user.googleId = profile.id;
            await user.save();
          }
        } else {
          // agar naya user hai to Google data se create karo
          user = await User.create({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            profileImage: profile.photos?.[0]?.value || null,
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// serialize user (session me sirf user ka id save karega)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// deserialize user (session se id le kar DB se poora user fetch karega)
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
