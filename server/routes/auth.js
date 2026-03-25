// routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const passport = require("passport");
const db = require("../db");
const axios = require("axios"); 

async function sendBrevoEmail(toEmail, subject, textContent, htmlContent) {
    try {
        await axios.post('https://api.brevo.com/v3/smtp/email', {
            sender: { name: "CoverageQuest", email: "leewanjing040501@gmail.com" },
            to: [{ email: toEmail }],
            subject: subject,
            textContent: textContent,
            htmlContent: htmlContent  
        }, {
            headers: {
                'api-key': process.env.BREVO_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        return true;
    } catch (error) {
        console.error("Brevo API Error:", error.response ? error.response.data : error.message);
        return false;
    }
}

// ====================== 發送註冊驗證碼 ======================
router.post('/send-reg-code', async (req, res) => {
    const { email } = req.body;

    try {
        const existing = await db.execute(
            "SELECT id, is_verified, reset_expires, code_attempts FROM users WHERE email = $1",
            [email]
        );

        if (existing.length > 0 && existing[0].is_verified === 1) {
            return res.json({ success: false, message: "Email already registered." });
        }

        if (existing.length > 0 && existing[0].code_attempts >= 5) {
            return res.json({ success: false, message: "Too many requests. Try again later." });
        }

        if (existing.length > 0 && existing[0].reset_expires) {
            const lastSent = new Date(existing[0].reset_expires).getTime() - (15 * 60000);
            const now = Date.now();
            if ((now - lastSent) < 60000) {
                return res.json({ success: false, message: "Please wait 60 seconds before requesting another code." });
            }
        }

        const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 15 * 60000);

        await db.execute(`
            INSERT INTO users (email, reset_code, reset_expires, is_verified, username, password, code_attempts)
            VALUES ($1, $2, $3, 0, 'pending_user', 'pending_pw', 1)
            ON CONFLICT(email)
            DO UPDATE SET
                reset_code = $2,
                reset_expires = $3,
                code_attempts = users.code_attempts + 1
        `, [email, verifyCode, expires]);

        const emailSent = await sendBrevoEmail(
            email,
            "CoverageQuest Verification Code",
            `Your verification code is: ${verifyCode}`,
            `<h2>CoverageQuest</h2><p>Your verification code:</p><h1>${verifyCode}</h1><p>This code expires in 15 minutes.</p>`
        );

        if (emailSent) {
            res.json({ success: true, message: "Code sent" });
        } else {
            res.status(500).json({ success: false, message: "Failed to send email" });
        }

    } catch (err) {
        console.error("Send Reg Code Error:", err.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ====================== 驗證註冊碼 ======================
router.post('/verify-code', async (req, res) => {
    const { email, code } = req.body;

    try {
        const user = await db.execute(
            "SELECT id FROM users WHERE email = $1 AND reset_code = $2 AND reset_expires > NOW()",
            [email, code]
        );

        if (user.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid or expired code." });
        }

        await db.execute(
            "UPDATE users SET is_verified = 1, reset_code = NULL, reset_expires = NULL WHERE email = $1",
            [email]
        );

        res.json({ success: true, message: "Email verified successfully! You can now login." });

    } catch (err) {
        console.error("Verify Code Error:", err.message);
        res.status(500).json({ success: false, message: "Server error." });
    }
});

// ====================== 完成註冊 ======================
router.post('/complete-registration', async (req, res) => {
    const { email, code, password, username } = req.body;

    try {
        const user = await db.execute(
            "SELECT id FROM users WHERE email = $1 AND reset_code = $2 AND reset_expires > NOW()",
            [email, code]
        );

        if (user.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid or expired code" });
        }

        const hashedPw = await bcrypt.hash(password, 10);

        await db.execute(
            "UPDATE users SET username = $1, password = $2, is_verified = 1, reset_code = NULL, reset_expires = NULL WHERE email = $3",
            [username, hashedPw, email]
        );

        res.json({ success: true, message: "Registration complete!" });
    } catch (err) {
        console.error("Complete Registration Error:", err.message);
        res.status(500).json({ success: false, message: "Final update failed" });
    }
});

// ====================== 登入 ======================
router.post('/login', (req, res, next) => {
    const { email, password } = req.body; 

    passport.authenticate('local', async (err, user, info) => {
        if (err) return next(err); 
        if (!user) return res.status(400).json({ success: false, message: info.message });

        req.logIn(user, async (err) => {
            if (err) return next(err);
            
            await db.execute("UPDATE users SET is_verified = 1 WHERE id = $1", [user.id]);
            return res.json({ success: true });
        });
    })(req, res, next);
});

router.get("/user", (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ success: true, user: req.user });
    } else {
        res.status(401).json({ success: false, user: null });
    }
});

// ====================== Google 登入 ======================
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get("/google/callback", 
    passport.authenticate("google", { failureRedirect: "/login.html" }),
    (req, res) => {
        req.session.save((err) => {
            if (err) {
                console.error("Session save error:", err);
                return res.redirect("/login.html");
            }
            res.redirect("/dashboard.html");
        });
    }
);

router.get("/logout", (req, res) => {
    req.logout(() => res.redirect("/index.html"));
});

// ====================== 忘記密碼 ======================
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const users = await db.execute(
            "SELECT id, email FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1::text))",
            [email]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "Email not found" });
        }

        const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 10 * 60000);

        await db.execute(
            "UPDATE users SET reset_code = $1, reset_expires = $2 WHERE email = $3",
            [verifyCode, expires, users[0].email]
        );

        const emailSent = await sendBrevoEmail(
            email,
            "CoverageQuest Verification Code",
            `Your reset code is: ${verifyCode}`,
            `<h2>CoverageQuest</h2><p>Your reset code:</p><h1>${verifyCode}</h1><p>This code expires in 15 minutes.</p>`
        );

        if (emailSent) {
            res.json({ success: true, message: "Code sent" });
        } else {
            res.status(500).json({ success: false, message: "Failed to send email" });
        }
    } catch (err) {
        console.error("Forgot Password Error:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ====================== 重設密碼 ======================
router.post('/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    try {
        const user = await db.execute(
            "SELECT id FROM users WHERE email = $1 AND reset_code = $2 AND reset_expires > NOW()", 
            [email, code]
        );

        if (user.length === 0) {
            return res.json({ success: false, message: "Invalid or expired code" });
        }

        const hashedPw = await bcrypt.hash(newPassword, 10);
        await db.execute(
            "UPDATE users SET password = $1, reset_code = NULL, reset_expires = NULL WHERE email = $2", 
            [hashedPw, email]
        );

        res.json({ success: true, message: "Password reset successfully!" });
    } catch (err) {
        console.error("Reset Password Error:", err.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ====================== 修改 Email 驗證碼 ======================
router.post('/send-update-email-code', async (req, res) => {
    const { newEmail } = req.body;
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not logged in" });

    try {
        const existing = await db.execute("SELECT id FROM users WHERE email = $1", [newEmail]);
        if (existing.length > 0) {
            return res.json({ success: false, message: "Email already in use by another account." });
        }

        const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 10 * 60000);

        await db.execute(
            "UPDATE users SET reset_code = $1, reset_expires = $2 WHERE id = $3",
            [verifyCode, expires, req.user.id]
        );

        const emailSent = await sendBrevoEmail(
            newEmail,
            "CoverageQuest Email Change Verification",
            `Your verification code is: ${verifyCode}`,
            `<h2>Change Email Verification</h2><p>Your code is: <h1>${verifyCode}</h1></p>`
        );

        if (emailSent) {
            res.json({ success: true, message: "Verification code sent to your new email." });
        } else {
            res.status(500).json({ success: false, message: "Failed to send email." });
        }
    } catch (err) {
        console.error("Send Update Email Code Error:", err.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ====================== 更新個人資料 ======================
router.post('/update-profile', async (req, res) => {
    try {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ message: "Not logged in" });
        }

        const { username, email, currentPassword, newPassword, emailCode } = req.body;
        const user = req.user;
        let finalPassword = user.password;

        if (newPassword) {
            if (!currentPassword) return res.status(400).json({ message: "Current password required to set new password." });
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) return res.status(400).json({ message: "Current password incorrect." });
            finalPassword = await bcrypt.hash(newPassword, 10);
        }

        if (email && email !== user.email) {
            if (!emailCode) {
                return res.status(400).json({ message: "Verification code is required to change email." });
            }
            const dbUser = await db.execute(
                "SELECT id FROM users WHERE id = $1 AND reset_code = $2 AND reset_expires > NOW()",
                [user.id, emailCode]
            );

            if (dbUser.length === 0) {
                return res.status(400).json({ message: "Invalid or expired email verification code." });
            }
        }

        await db.execute(
            "UPDATE users SET username = $1, email = $2, password = $3, reset_code = NULL, reset_expires = NULL WHERE id = $4",
            [username || user.username, email || user.email, finalPassword, user.id]
        );

        // 更新 session 中的 user 資料
        req.user.username = username || user.username;
        req.user.email = email || user.email;
        req.user.password = finalPassword;

        res.json({ success: true, message: "Profile updated successfully!" });

    } catch (err) {
        console.error("Update Profile Error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;