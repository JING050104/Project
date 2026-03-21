// passport.js
const LocalStrategy = require("passport-local").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const bcrypt = require("bcryptjs");
const db = require("./db"); 

module.exports = function(passport) {

  // 1. Serialize User
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // 2. Deserialize User
  passport.deserializeUser(async (id, done) => {
    try {
      const rows = await db.execute("SELECT * FROM users WHERE id = $1", [id]);
      
      if (!rows || rows.length === 0) {
        return done(null, false);
      }
      
      done(null, rows[0]);
    } catch (err) {
      console.error("Deserialize Error:", err.message);
      done(err, null);
    }
  });

  // ====================== Local Strategy ======================
  passport.use(
    new LocalStrategy(
      { usernameField: "identifier", passwordField: "password" }, 
      async (identifier, password, done) => {
        try {
          const rows = await db.execute(
            "SELECT * FROM users WHERE (email = $1 OR username = $1) AND is_verified = 1",
            [identifier]
          );

          if (rows.length === 0) {
            return done(null, false, { message: "Account not verified or user not found." });
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
        // 檢查是否已用 Google ID 註冊
        const existingUser = await db.execute(
          "SELECT * FROM users WHERE google_id = $1", 
          [profile.id]
        );

        if (existingUser.length > 0) {
          return done(null, existingUser[0]);
        }

        // 檢查 email 是否已存在
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

        // 建立新用戶
        const newUserRows = await db.execute(
          `INSERT INTO users (username, email, google_id, password, is_verified) 
           VALUES ($1, $2, $3, $4, 1) 
           RETURNING id, username, email`,
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