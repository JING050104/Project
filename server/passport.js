const LocalStrategy = require("passport-local").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const bcrypt = require("bcryptjs");
const db = require("./db");

module.exports = function(passport) {
  // 1. Serialize
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // 2. Deserialize
  passport.deserializeUser(async (id, done) => {
    try {
      const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
      const user = result.rows[0];
      if (!user) {
        console.log("Deserialize: User not found in DB");
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      console.error("Deserialize Error:", err);
      done(err, null);
    }
  });

  // --- Local Strategy ---
  passport.use(
    new LocalStrategy(
      { usernameField: "identifier", passwordField: "password" },
      async (identifier, password, done) => {
        try {
          const result = await db.query(
            "SELECT * FROM users WHERE (email = $1 OR username = $1) AND is_verified = 1",
            [identifier]
          );

          const user = result.rows[0]; 

          if (!user) {
            return done(null, false, { message: "Account not verified or user not found." });
          }

          const isMatch = await bcrypt.compare(password, user.password);
          if (isMatch) return done(null, user);
          else return done(null, false, { message: "Incorrect password." });
        } catch (err) {
          console.error("Passport Auth Error:", err);
          return done(err);
        }
      }
    )
  );

  // --- Google Strategy ---
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://project-shbe.onrender.com/auth/google/callback"
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;

        const idCheck = await db.query("SELECT * FROM users WHERE google_id = $1::text", [profile.id]);
        if (idCheck.rows.length > 0) return done(null, idCheck.rows[0]);

        const emailCheck = await db.query("SELECT * FROM users WHERE email = $1::text", [email]);
        if (emailCheck.rows.length > 0) {
          await db.query(
            "UPDATE users SET google_id = $1::text, is_verified = 1 WHERE email = $2::text",
            [profile.id, email]
          );
          const updatedUser = emailCheck.rows[0];
          updatedUser.google_id = profile.id;
          updatedUser.is_verified = 1;
          return done(null, updatedUser);
        }

        const insertResult = await db.query(
          "INSERT INTO users (username, email, google_id, password, is_verified) VALUES ($1::text, $2::text, $3::text, $4::text, 1) RETURNING *",
          [profile.displayName, email, profile.id, "GOOGLE_AUTH"]
        );

        const newUser = insertResult.rows[0];
        if (!newUser) {
          throw new Error("Failed to create new user via Google Auth");
        }

        return done(null, newUser);
      } catch (err) {
        console.error("Google Auth Error:", err);
        return done(err, null);
      }
    }
  ));
};