const LocalStrategy = require("passport-local").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const bcrypt = require("bcryptjs");
const db = require("./db"); 

module.exports = function(passport) {
  // 1. Serialize
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // 2. Deserialize (加上 ::int 转换 ID 类型)
  passport.deserializeUser(async (id, done) => {
    try {
      const [rows] = await db.execute("SELECT * FROM users WHERE id = $1::int", [id]);
      if (!rows || rows.length === 0) return done(null, false);
      done(null, rows[0]);
    } catch (err) {
      done(err, null);
    }
  });

  // Local Strategy
  passport.use(
    new LocalStrategy(
      { usernameField: "identifier", passwordField: "password" }, 
      async (identifier, password, done) => {
        try {
          // 核心修复：确保 identifier 同时匹配 email 和 username，且显式转换类型
          const [rows] = await db.execute(
              "SELECT * FROM users WHERE (email = $1::text OR username = $2::text)", 
              [identifier, identifier]
          );
          
          const user = rows[0];
          if (!user) return done(null, false, { message: "Account not found." });
          
          // 检查是否验证过邮箱
          if (user.is_verified === 0) return done(null, false, { message: "Please verify your email first." });

          const isMatch = await bcrypt.compare(password, user.password);
          if (isMatch) return done(null, user);
          else return done(null, false, { message: "Incorrect password." });
        } catch (err) {
          console.error("Passport Auth Error:", err); // 在 Render Logs 查看具体错误
          return done(err);
        }
      }
    )
  );

  // Google Strategy
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://project-shbe.onrender.com/auth/google/callback"
      },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // 1. Check Google ID (加上 ::text)
        const [existingUser] = await db.execute("SELECT * FROM users WHERE google_id = $1::text", [profile.id]);
        if (existingUser.length > 0) return done(null, existingUser[0]);

        // 2. Check Email (加上 ::text)
        const [emailUser] = await db.execute("SELECT * FROM users WHERE email = $1::text", [profile.emails[0].value]);
        if (emailUser.length > 0) {
          await db.execute("UPDATE users SET google_id = $1::text WHERE email = $2::text", [profile.id, profile.emails[0].value]);
          emailUser[0].google_id = profile.id; 
          return done(null, emailUser[0]);
        }

        // 3. Create New User
        const [result] = await db.execute(
          "INSERT INTO users (username, email, google_id, password) VALUES ($1::text, $2::text, $3::text, $4::text) RETURNING id",
          [profile.displayName, profile.emails[0].value, profile.id, "GOOGLE_AUTH"]
        );

        const newUserId = result[0]?.id; 

        if (!newUserId) {
            throw new Error("Failed to retrieve new user ID from database");
        }

        const newUser = {
          id: newUserId, 
          username: profile.displayName,
          email: profile.emails[0].value
        };

        return done(null, newUser);
      } catch (err) {
        console.error("Google Auth Error:", err);
        return done(err, null);
      }
    }
  ));
};