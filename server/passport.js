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
// server/passport.js

// --- 反序列化修正 ---
passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1::int", [id]);
    const user = result.rows[0]; // 从 rows 数组中取第一行
    if (!user) return done(null, false);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// --- Google Strategy 修正 (报错的第 68 行就在这里) ---
async (accessToken, refreshToken, profile, done) => {
  try {
    // 1. 检查 Google ID (去掉左边的中括号)
    const idResult = await db.execute("SELECT * FROM users WHERE google_id = $1::text", [profile.id]);
    if (idResult.rows.length > 0) return done(null, idResult.rows[0]);

    // 2. 检查 Email (去掉左边的中括号)
    const email = profile.emails[0].value;
    const emailResult = await db.execute("SELECT * FROM users WHERE email = $1::text", [email]);
    
    if (emailResult.rows.length > 0) {
      await db.execute("UPDATE users SET google_id = $1::text WHERE email = $2::text", [profile.id, email]);
      const user = emailResult.rows[0];
      user.google_id = profile.id;
      return done(null, user);
    }

    // 3. 创建新用户 (去掉左边的中括号)
    const insertResult = await db.execute(
      "INSERT INTO users (username, email, google_id, password) VALUES ($1, $2, $3, $4) RETURNING id",
      [profile.displayName, email, profile.id, "GOOGLE_AUTH"]
    );
    
    const newUser = {
      id: insertResult.rows[0].id,
      username: profile.displayName,
      email: email
    };
    done(null, newUser);
  } catch (err) {
    console.error("Google Auth Error:", err);
    done(err, null);
  }
}

  // Local Strategy
  passport.use(
    new LocalStrategy(
      { usernameField: "identifier", passwordField: "password" }, 
      async (identifier, password, done) => {
        try {
          const [rows] = await db.execute(
              "SELECT * FROM users WHERE (email = $1 OR username = $1) AND is_verified = 1",
              [identifier]
          );

          if (rows.length === 0) {
              return done(null, false, { message: "Account not verified or user not found." });
          }
          
          const result = await db.execute("SELECT * FROM users WHERE ...", [identifier]);
          const user = result.rows[0];
          if (!user) {
              return done(null, false, { message: "User not found." });
          }
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
};