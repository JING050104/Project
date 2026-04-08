// passport.js
const LocalStrategy = require("passport-local").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const bcrypt = require("bcryptjs");
const db = require("./db");

module.exports = function (passport) {

  // 1. Serialize User
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const result = await db.execute("SELECT * FROM users WHERE id = $1", [id]);

      const user = (result.rows && result.rows.length > 0) ? result.rows[0] : result[0];

      console.log("------------------------------------------");
      console.log("DEBUG: Deserializing user ID:", id);
      console.log("DEBUG: Full User Object from DB:", user);
      console.log("DEBUG: Detected Role:", user ? user.role : "UNDEFINED");
      console.log("------------------------------------------");

      done(null, user);
    } catch (err) {
      console.error("Deserialize Error:", err.message);
      done(err, null);
    }
  });

  // ====================== Local Strategy ======================
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password"
      },
      async (email, password, done) => {
        try {
          const rows = await db.execute(
            "SELECT * FROM users WHERE email = $1 AND is_verified = 1",
            [email]
          );

          if (rows.length === 0) {
            return done(null, false, { message: "Invalid email or account not verified." });
          }

          const user = rows[0];

          if (user.is_verified === 0) {
            return done(null, false, { message: "Please verify your email first." });
          }

          const isMatch = await bcrypt.compare(password, user.password);
          if (isMatch) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Incorrect password." });
          }
        } catch (err) {
          console.error("Local Auth Error:", err.message);
          return done(err);
        }
      }
    )
  );

  // ====================== Google Strategy ======================
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/auth/google/callback"
  },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const existingUser = await db.execute(
          "SELECT * FROM users WHERE google_id = $1",
          [profile.id]
        );

        if (existingUser.length > 0) {
          return done(null, existingUser[0]);
        }

        const emailUser = await db.execute(
          "SELECT * FROM users WHERE email = $1",
          [profile.emails[0].value]
        );

        if (emailUser.length > 0) {
          await db.execute(
            "UPDATE users SET google_id = $1 WHERE email = $2",
            [profile.id, profile.emails[0].value]
          );
          emailUser[0].google_id = profile.id;
          return done(null, emailUser[0]);
        }

        const newUserRows = await db.execute(
          `INSERT INTO users (username, email, google_id, password, is_verified, role) 
          VALUES ($1, $2, $3, $4, 1, 'user') 
          RETURNING *`,
          [profile.displayName, profile.emails[0].value, profile.id, "GOOGLE_AUTH"]
        );

        if (newUserRows.length === 0) {
          throw new Error("Failed to create new user");
        }

        return done(null, newUserRows[0]);

      } catch (err) {
        console.error("Google Auth Error:", err.message);
        return done(err, null);
      }
    }
  ));
};