const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const passport = require("passport");
const db = require("../db");
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // 587 端口必须为 false
    auth: {
        user: 'i23024235@student.newinti.edu.my',
        pass: 'dciq fgfl emvg awlr' // 确保这是 16 位 App Password
    },
    tls: {
        rejectUnauthorized: false // 允许在受限网络环境下建立连接
    },
    connectionTimeout: 20000, // 增加到 20 秒，给云端更多响应时间
});

router.post('/send-reg-code', async (req, res) => {
    const { email } = req.body;
    try {
        // 1. 手动检查邮箱是否存在
        const [existing] = await db.execute("SELECT id, is_verified FROM users WHERE email = $1", [email]);

        if (existing && existing.length > 0 && existing[0].is_verified === 1) {
            return res.json({ success: false, message: "Email already registered." });
        }

        const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 15 * 60000);

        if (existing && existing.length > 0) {
            // 2. 存在但未验证，更新验证码
            await db.execute(
                "UPDATE users SET reset_code = $1, reset_expires = $2 WHERE email = $3",
                [verifyCode, expires, email]
            );
        } else {
            // 3. 不存在，插入新用户
            const tempUsername = 'user_' + Date.now();
            await db.execute(
                "INSERT INTO users (email, reset_code, reset_expires, is_verified, username, password) VALUES ($1, $2, $3, 0, $4, 'pending_pw')",
                [email, verifyCode, expires, tempUsername]
            );
        }

        // 4. 只有数据库操作成功后才发送邮件
        await transporter.sendMail({
            to: email,
            subject: 'CoverageQuest Registration Code',
            text: `Your verification code is: ${verifyCode}`
        });

        res.json({ success: true, message: "Code sent!" });

    } catch (err) {
        console.error("REG ERROR:", err); // 在 Render 日志中查看具体错误
        res.status(500).json({ success: false, message: "Server error, code not sent." });
    }
});

// 2. 
router.post('/complete-registration', async (req, res) => {
    const { email, code, password, username } = req.body; 
    try {
        const [user] = await db.execute(
            "SELECT id FROM users WHERE email = $1 AND reset_code = $2 AND reset_expires > NOW()",
            [email, code]
        );

        if (!user || user.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid or expired code" });
        }

        const hashedPw = await bcrypt.hash(password, 10); 
        
        await db.execute(
            "UPDATE users SET username = $1, password = $2, is_verified = 1, reset_code = NULL, reset_expires = NULL WHERE email = $3",
            [username, hashedPw, email]
        );

        res.json({ success: true, message: "Registration complete!" });
    } catch (err) {
        console.error("FINAL REGISTRATION ERROR:", err.message);
        res.status(500).json({ success: false, message: "Final update failed" });
    }
});

// LOGIN ROUTE
router.post("/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
        if (err) {
            console.error("Login Error:", err);
            return res.status(500).json({ success: false, message: "Server error during login." });
        }
        
        // 核心修复：如果验证失败，返回 JSON 错误信息，而不是 redirect
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: info ? info.message : "Invalid credentials." 
            });
        }

        req.logIn(user, (err) => {
            if (err) return next(err);
            req.session.save((err) => {
                if (err) return next(err);
                return res.json({ success: true, message: "Login successful" });
            });
        });
    })(req, res, next);
});

router.get("/user", (req, res) => {
  if (req.isAuthenticated()) {
    // Send back the user data if logged in
    res.json({ success: true, user: req.user });
  } else {
    // Send a 401 Unauthorized status if not logged in
    res.status(401).json({ success: false, user: null });
  }
});

// GOOGLE ROUTES
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get("/google/callback", 
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => {
    // Manually save the session before redirecting
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.redirect("/login.html");
      }
      res.redirect("/dashboard.html");
    });
  }
);

// LOGOUT
router.get("/logout", (req, res) => {
  req.logout(() => res.redirect("/index.html"));
});

//forgot-password
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const [users] = await db.execute(
            "SELECT id, email FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))", 
            [email]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "Email not found" });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 10 * 60000);

        // 1. 先更新数据库
        await db.execute(
            "UPDATE users SET reset_code = $1, reset_expires = $2 WHERE email = $3", 
            [code, expires, users[0].email]
        );

        // 2. 发送邮件并添加等待
        await transporter.sendMail({
            to: email,
            subject: 'CoverageQuest Reset Code',
            text: `Your verification code is: ${code}`
        });

        // 3. 只有成功后才返回 true
        return res.json({ success: true, message: "Reset code sent!" });

    } catch (err) {
        console.error("DETAILED EMAIL ERROR:", err);
        // 关键：即使邮件发送失败，也要向前端返回错误，防止页面卡死
        return res.status(500).json({ 
            success: false, 
            message: "Mail server timeout. Please try again in a few minutes." 
        });
    }
});

//RESET PASSWORD
router.post('/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    try {
        const [user] = await db.execute(
            "SELECT id FROM users WHERE email = $1 AND reset_code = $2 AND reset_expires > NOW()", 
            [email, code]
        );

        if (user.length === 0) return res.json({ success: false, message: "Invalid or expired code" });

        const hashedPw = await require('bcryptjs').hash(newPassword, 10);
        await db.execute("UPDATE users SET password = $1, reset_code = NULL, reset_expires = NULL WHERE email = $2", [hashedPw, email]);

        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

router.post('/update-profile', async (req, res) => {
    try {
        if (!req.isAuthenticated()) { 
            return res.status(401).json({ message: "Not logged in" });
        }

        const { username, email, currentPassword, newPassword } = req.body;
        const user = req.user;

        // 1. Verify password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Current password incorrect" });
        }

        // 2. Hash new password if provided, otherwise keep old one
        let finalPassword = user.password;
        if (newPassword) {
            finalPassword = await bcrypt.hash(newPassword, 10);
        }

        // 3. Update Database via SQL Query
        await db.execute(
            "UPDATE users SET username = $1, email = $2, password = $3 WHERE id = $4",
            [username, email, finalPassword, user.id]
        );

        // 4. Update the session so the UI updates
        req.user.username = username;
        req.user.email = email;
        req.user.password = finalPassword;

        res.json({ success: true, message: "Profile updated!" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});
module.exports = router;