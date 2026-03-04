const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const passport = require("passport");
const db = require("../db");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// 1. 
router.post('/send-reg-code', async (req, res) => {

    const { email } = req.body;

    try {

        const [existing] = await db.execute(
            "SELECT id, is_verified, reset_expires, code_attempts FROM users WHERE email = $1",
            [email]
        );

        if (existing.length > 0 && existing[0].is_verified === 1) {
            return res.json({
                success:false,
                message:"Email already registered."
            });
        }

        if (existing.length > 0 && existing[0].code_attempts >= 5) {
            return res.json({
                success:false,
                message:"Too many requests. Try again later."
            });
        }

        if (existing.length > 0 && existing[0].reset_expires) {

            const lastSent = new Date(existing[0].reset_expires).getTime() - (15 * 60000);
            const now = Date.now();

            if ((now - lastSent) < 60000) {
                return res.json({
                    success:false,
                    message:"Please wait 60 seconds before requesting another code."
                });
            }
        }

        const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 15 * 60000);

        await db.execute(`
            INSERT INTO users (email, reset_code, reset_expires, is_verified, username, password, code_attempts)
            VALUES ($1,$2,$3,0,'pending_user','pending_pw',1)
            ON CONFLICT(email)
            DO UPDATE SET
                reset_code = $2,
                reset_expires = $3,
                code_attempts = users.code_attempts + 1
        `,[email,verifyCode,expires]);

        await sgMail.send({
            to: email,
            from: "leewanjing040501@gmail.com",
            subject: "CoverageQuest Registration Code",
            text: `Your verification code is: ${verifyCode}`
        });

        res.json({success:true,message:"Code sent"});

    } catch(err) {

        console.error(err);

        res.status(500).json({
            success:false,
            message:"Server error"
        });

    }

});

// VERIFY CODE
router.post('/verify-code', async (req, res) => {
    const { email, code } = req.body;

    try {

        const [user] = await db.execute(
            "SELECT id FROM users WHERE email = $1 AND reset_code = $2 AND reset_expires > NOW()",
            [email, code]
        );

        if (!user || user.length === 0) {
            return res.json({
                success:false,
                message:"Invalid or expired code"
            });
        }

        return res.json({
            success:true,
            message:"Code verified"
        });

    } catch(err){
        console.error("VERIFY CODE ERROR:", err);
        res.status(500).json({
            success:false,
            message:"Server error"
        });
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

        // 核心修正：必须加 await 且调用 bcrypt.hash
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

// FORGOT PASSWORD
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const [users] = await db.execute(
            "SELECT id, email FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1::text))",
            [email]
        );

        if (!users || users.length === 0) {
            return res.status(404).json({ success: false, message: "Email not found" });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 10 * 60000); // 10 minutes

        await db.execute(
            "UPDATE users SET reset_code = $1, reset_expires = $2 WHERE email = $3",
            [code, expires, users[0].email]
        );

        await sgMail.send({
            to: email,
            from: "leewanjing040501@gmail.com",
            subject: "CoverageQuest Registration Code",
            text: `Your verification code is: ${code}`,
        });

        return res.json({ success: true, message: "Code sent!" });

    } catch (err) {
    console.error("FULL ERROR:", err);
    return res.status(500).json({
        success: false,
        message: err.message
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

// VERIFY CODE ONLY
router.post('/verify-code', async (req, res) => {
    const { email, code } = req.body;

    try {

        const [user] = await db.execute(
            "SELECT id FROM users WHERE email = $1 AND reset_code = $2 AND reset_expires > NOW()",
            [email, code]
        );

        if (!user || user.length === 0) {
            return res.json({
                success:false,
                message:"Invalid or expired code"
            });
        }

        return res.json({
            success:true,
            message:"Code verified"
        });

    } catch(err){
        console.error("VERIFY CODE ERROR:", err);
        res.status(500).json({
            success:false,
            message:"Server error"
        });
    }
});
module.exports = router;