const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const passport = require("passport");
const db = require("../db");
const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// SEND VERIFICATION CODE
router.post('/send-code', async (req, res) => {

    const { email, type } = req.body;

    try {

        const [existing] = await db.execute(
            "SELECT id, is_verified, reset_expires, code_attempts FROM users WHERE email = $1",
            [email]
        );


        // REGISTER CHECK
        if (type === "register") {
            if (existing.length > 0 && existing[0].is_verified === 1) {
                return res.json({
                    success:false,
                    message:"Email already registered."
                });
            }
        }


        // RESET CHECK
        if (type === "reset") {
            if (existing.length === 0) {
                return res.json({
                    success:false,
                    message:"Email not found."
                });
            }
        }


        // LIMIT ATTEMPTS
        if (existing.length > 0 && existing[0].code_attempts >= 5) {
            return res.json({
                success:false,
                message:"Too many requests. Try again later."
            });
        }


        // RESEND COOLDOWN
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
            from: "CoverageQuest <leewanjing040501@gmail.com>",
            subject: "CoverageQuest Verification Code",
            text: `Your verification code is: ${verifyCode}`,
            html: `
                <h2>CoverageQuest</h2>
                <p>Your verification code:</p>
                <h1>${verifyCode}</h1>
                <p>This code expires in 10 minutes.</p>
            `
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

        console.error(err);

        res.status(500).json({
            success:false,
            message:"Server error"
        });

    }

});

// COMPLETE REGISTRATION
router.post('/complete-registration', async (req, res) => {

    const { email, code, password, username } = req.body;

    try {

        const [user] = await db.execute(
            "SELECT id FROM users WHERE email = $1 AND reset_code = $2 AND reset_expires > NOW()",
            [email, code]
        );

        if (!user || user.length === 0) {
            return res.status(400).json({
                success:false,
                message:"Invalid or expired code"
            });
        }


        const hashedPw = await bcrypt.hash(password, 10);


        await db.execute(
            "UPDATE users SET username=$1,password=$2,is_verified=1,reset_code=NULL,reset_expires=NULL WHERE email=$3",
            [username, hashedPw, email]
        );


        res.json({
            success:true,
            message:"Registration complete!"
        });


    } catch(err) {

        console.error(err);

        res.status(500).json({
            success:false,
            message:"Registration failed"
        });

    }

});



// RESET PASSWORD
router.post('/reset-password', async (req, res) => {

    const { email, code, newPassword } = req.body;

    try {

        const [user] = await db.execute(
            "SELECT id FROM users WHERE email=$1 AND reset_code=$2 AND reset_expires > NOW()",
            [email, code]
        );

        if (user.length === 0) {
            return res.json({
                success:false,
                message:"Invalid or expired code"
            });
        }


        const hashedPw = await bcrypt.hash(newPassword, 10);


        await db.execute(
            "UPDATE users SET password=$1,reset_code=NULL,reset_expires=NULL WHERE email=$2",
            [hashedPw, email]
        );


        res.json({
            success:true,
            message:"Password updated"
        });

    } catch(err) {

        console.error(err);

        res.status(500).json({
            success:false,
            message:"Reset failed"
        });

    }

});

// LOGIN
router.post("/login", (req, res, next) => {

    passport.authenticate("local", (err, user, info) => {

        if (err) {
            return res.status(500).json({
                success:false,
                message:"Server error"
            });
        }

        if (!user) {
            return res.status(401).json({
                success:false,
                message: info ? info.message : "Invalid credentials"
            });
        }

        req.logIn(user, err => {

            if (err) return next(err);

            req.session.save(err => {

                if (err) return next(err);

                res.json({
                    success:true,
                    message:"Login successful"
                });

            });

        });

    })(req,res,next);

});

// USER SESSION
router.get("/user", (req,res)=>{

    if(req.isAuthenticated()){
        res.json({success:true,user:req.user});
    }else{
        res.status(401).json({success:false});
    }

});

// GOOGLE LOGIN
router.get("/google",
    passport.authenticate("google",{scope:["profile","email"]})
);

router.get("/google/callback",
    passport.authenticate("google",{failureRedirect:"/login.html"}),
    (req,res)=>{
        req.session.save(()=>{
            res.redirect("/dashboard.html");
        });
    }
);

// LOGOUT
router.get("/logout",(req,res)=>{
    req.logout(()=>{
        res.redirect("/index.html");
    });
});

module.exports = router;