require('dotenv').config();
const { Pool } = require('pg');
const express = require("express");
const session = require("express-session");
const pgSession = require('connect-pg-simple')(session);
const passport = require("passport");
const path = require("path");
const db = require("./db");
const authRoutes = require('./routes/auth');
const ensureAuthenticated = require("./middleware/auth");
const multer = require('multer');
const xlsx = require('xlsx');
const cloudinary = require('./cloudinary');
const streamifier = require('streamifier');

const upload = multer({ storage: multer.memoryStorage() });
const app = express();
const fs = require('fs');
const toTitleCase = (str) => {
    if (str === null || str === undefined) return "";
    return str.toString()
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const uploadAvatar = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPG, PNG and WEBP images are allowed'));
        }
    }
});


require('./passport')(passport);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    store: new pgSession({
        pool: db.pool,
        tableName: 'session',
        ttl: 86400,
        pruneSessionInterval: 60,
    }),
    key: 'fyp_session_cookie',
    secret: process.env.SESSION_SECRET || "fyp_secret",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 86400000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

app.get("/", (req, res) => {
    console.log("Root path access. Authenticated:", req.isAuthenticated());
    if (req.isAuthenticated()) {
        const userRole = String(req.user.role).trim().toLowerCase();
        console.log("User Role:", userRole);
        if (userRole === 'admin') {
            return res.redirect("/admin.html");
        } else {
            return res.redirect("/dashboard.html");
        }
    }
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/admin.html", (req, res, next) => {
    if (req.isAuthenticated() && String(req.user.role).trim().toLowerCase() === 'admin') {
        return res.sendFile(path.join(__dirname, "../public/admin.html"));
    } else {
        console.log("Unauthorized access to admin.html, redirecting...");
        return res.redirect("/");
    }
});

app.use("/api/admin", (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: "No access." });
    }
});

app.use(express.static(path.resolve(__dirname, '..', 'public')));
app.use("/auth", authRoutes);

// A. 獲取積分
app.get("/api/get-points", ensureAuthenticated, async (req, res) => {
    try {
        const rows = await db.execute("SELECT total_points FROM user_points WHERE user_id = $1", [req.user.id]);
        const points = rows[0] ? rows[0].total_points : 0;
        res.json({ points });
    } catch (err) {
        console.error("Get Points Error:", err);
        res.status(500).json({ error: "Failed to fetch points." });
    }
});

app.get('/api/get-vouchers', ensureAuthenticated, async (req, res) => {
    try {
        const rows = await db.execute(`
            SELECT id, name, cost, stock, description 
            FROM vouchers 
            WHERE stock > 0 
            ORDER BY cost ASC
        `);
        res.json(rows || []);
    } catch (err) {
        console.error("Get Vouchers Error:", err.message);
        res.status(500).json({ error: "Failed to load vouchers" });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    const { gameType } = req.query;
    const currentUserId = req.user?.id || null;

    try {
        let personalBestSort = "";
        let finalDisplaySort = "";

        if (gameType === 'RiskDefender') {
            personalBestSort = "reached_level DESC, score DESC, time_used ASC";
            finalDisplaySort = "reached_level DESC, score DESC, time_used ASC";
        } else if (gameType === 'RiskFinder') {
            personalBestSort = "score DESC, reached_level DESC, time_used ASC";
            finalDisplaySort = "score DESC, reached_level DESC, time_used ASC";
        } else {
            personalBestSort = "score DESC, time_used ASC";
            finalDisplaySort = "score DESC, time_used ASC";
        }

        const rankedQuery = `
            SELECT 
                ROW_NUMBER() OVER (ORDER BY ${finalDisplaySort}) as rank,
                user_id,
                username,
                profile_image,
                score,
                reached_level,
                time_used
            FROM (
                SELECT DISTINCT ON (s.user_id)
                    s.user_id,
                    u.username,
                    u.profile_image,
                    s.score,
                    s.reached_level,
                    s.time_used
                FROM scores s
                LEFT JOIN users u ON s.user_id = u.id
                WHERE s.game_type = $1
                ORDER BY s.user_id, ${personalBestSort}
            ) AS unique_scores
            ORDER BY ${finalDisplaySort}
        `;

        const rankedRes = await db.query(rankedQuery, [gameType]);
        const rankedList = rankedRes.rows || rankedRes || [];

        const topTen = rankedList.slice(0, 10);
        const userStats = currentUserId
            ? rankedList.find(row => Number(row.user_id) === Number(currentUserId)) || null
            : null;

        res.json({
            topTen,
            userStats
        });

    } catch (err) {
        console.error("Leaderboard Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// B. 大轉盤
app.post("/api/spin-reward", ensureAuthenticated, async (req, res) => {
    const userId = req.user.id;
    const { reward } = req.body;

    if (!reward || !reward.includes("pts")) {
        return res.json({ success: false, error: "No points earned" });
    }

    const points = parseInt(reward);

    try {
        const checkResult = await db.execute(`
            SELECT transaction_id FROM point_transactions 
            WHERE user_id = $1 
            AND activity_type = 'Daily Spin' 
            AND created_at >= CURRENT_DATE`,
            [userId]
        );

        if (checkResult.length > 0) {
            return res.status(403).json({
                success: false,
                error: "You already spin today, please come back tomorrow!"
            });
        }

        await db.execute('BEGIN');

        await db.execute(`
            INSERT INTO user_points (user_id, total_points, last_updated) 
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                total_points = user_points.total_points + $2,
                last_updated = CURRENT_TIMESTAMP`,
            [userId, points]
        );

        await db.execute(`
            INSERT INTO point_transactions (user_id, points_change, activity_type, description, created_at) 
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [userId, points, 'Daily Spin', `Spin Win: ${reward}`]
        );

        await db.execute('COMMIT');
        res.json({ success: true, type: 'points' });

    } catch (err) {
        try { await db.execute('ROLLBACK'); } catch (e) { }
        console.error("Spin Reward Error Details:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/api/check-spin-status", ensureAuthenticated, async (req, res) => {
    const result = await db.execute(`
        SELECT transaction_id FROM point_transactions 
        WHERE user_id = $1 AND activity_type = 'Daily Spin' 
        AND created_at >= CURRENT_DATE`, [req.user.id]);
    res.json({ canSpin: result.length === 0 });
});

// C. 獲取背包
app.get('/api/get-inventory', ensureAuthenticated, async (req, res) => {
    const query = `
        SELECT 
            i.id as "id", 
            COALESCE(v.name, i.item_name) as "item_name", 
            i.status as "status",
            i.redeem_code as "redeem_code",
            activated_at AS "activated_at", 
            v.description AS "description",
            i.expired_at as "expired_at"
        FROM user_inventory i
        LEFT JOIN vouchers v ON i.voucher_id = v.id
        WHERE i.user_id = $1
        ORDER BY i.id DESC
    `;

    try {
        const inventoryData = await db.execute(query, [req.user.id]);
        console.log("Sending Inventory to Frontend:", inventoryData);
        res.json(inventoryData);
    } catch (err) {
        console.error("Inventory Fetch Error:", err.message);
        res.status(500).json({ error: "Failed to load inventory" });
    }
});

// D. 激活道具
app.post('/api/activate-item', ensureAuthenticated, async (req, res) => {

    const userId = req.user.id;
    const { inventoryId } = req.body;

    if (!inventoryId) {
        return res.status(400).json({ error: "Missing inventoryId" });
    }

    const activatedAt = new Date();
    const expiredAt = new Date(activatedAt.getTime() + 7 * 24 * 60 * 60 * 1000)

    try {
        const newCode = "CQ-" + Math.random().toString(36).substring(2, 8).toUpperCase();

        const result = await db.execute(`
            UPDATE user_inventory 
            SET 
                status = 'active', 
                redeem_code = $1, 
                expired_at = $2, 
                activated_at = $3
            WHERE id = $4 
              AND user_id = $5 
              AND status = 'inactive'
            RETURNING id, redeem_code, expired_at, activated_at
        `, [newCode, expiredAt, activatedAt, inventoryId, userId]);

        if (result.length === 0) {
            return res.status(400).json({
                error: "Item not found, already activated, or does not belong to you."
            });
        }

        res.json({
            success: true,
            redeemCode: result[0].redeem_code,
            expiredAt: result[0].expired_at
        });

    } catch (err) {
        console.error("Activation Error:", err.message);
        res.status(500).json({ error: "Activation failed: " + err.message });
    }
});

app.post("/api/save-score", ensureAuthenticated, async (req, res) => {
    const userId = req.user.id;

    const username = req.user.username || req.user.email || 'Unknown';
    const { score, reached_level, gameType, time_used } = req.body;

    if (reached_level < 5) {
        return res.json({
            success: false,
            message: "You doesn't reach wave 5, Score will be not recorded!"
        });
    }

    if (!score || score <= 0) {
        return res.json({ success: true, message: "0 points, not saved." });
    }

    try {
        const checkPlayedToday = await db.execute(`
            SELECT id FROM scores 
            WHERE user_id = $1 
            AND game_type = $2 
            AND DATE(created_at) = CURRENT_DATE
        `, [userId, gameType]);

        if (checkPlayedToday.rows && checkPlayedToday.rows.length > 0) {
            return res.json({
                success: false,
                message: `You already done ${gameType} challenge, Please come back tomorrow!`
            });
        }

        await db.execute('BEGIN');

        await db.execute(`
            INSERT INTO user_points (user_id, total_points, last_updated)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                total_points = user_points.total_points + $2,
                last_updated = CURRENT_TIMESTAMP`,
            [userId, score]
        );

        await db.execute(`
            INSERT INTO point_transactions (user_id, points_change, activity_type, description, created_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [userId, score, 'Game Reward', `Played ${gameType} - Level ${reached_level}`]
        );

        await db.execute(`
            INSERT INTO scores (user_id, username, score, reached_level, game_type, time_used, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
            [userId, username, score, reached_level, gameType, time_used]
        );

        await db.execute('COMMIT');
        res.json({ success: true, message: "Save Successfully!" });

    } catch (err) {
        await db.execute('ROLLBACK');
        console.error("Save Score Error Details:", err.message);
        res.status(500).json({ success: false, error: "System error" });
    }
});

app.get("/api/check-can-play", ensureAuthenticated, async (req, res) => {
    const userId = req.user.id;
    const { gameType } = req.query;


    try {
        const result = await db.execute(`
            SELECT id FROM scores 
            WHERE user_id = $1 
            AND game_type = $2 
            AND DATE(created_at) = CURRENT_DATE
            LIMIT 1
        `, [userId, gameType]);

        res.json({
            canPlay: result.length === 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// F. 兌換禮券（已優化）
app.post("/api/redeem-voucher", ensureAuthenticated, async (req, res) => {
    const userId = req.user.id;
    const { voucherName, cost } = req.body;

    if (!voucherName || cost == null) {
        return res.status(400).json({ error: "Missing voucherName or cost" });
    }

    try {
        await db.execute('BEGIN');

        const existing = await db.execute(
            `SELECT id FROM user_inventory 
             WHERE user_id = $1 AND item_name = $2 
             AND (status = 'inactive' OR (status = 'active' AND (expired_at > NOW())))`,
            [userId, voucherName]
        );

        if (existing.length > 0) {
            await db.execute('ROLLBACK');
            return res.status(400).json({ error: `You already have a ${voucherName}` });
        }

        const pointRes = await db.execute("SELECT total_points FROM user_points WHERE user_id = $1", [userId]);
        const currentPoints = pointRes[0] ? pointRes[0].total_points : 0;

        if (currentPoints < cost) {
            await db.execute('ROLLBACK');
            return res.status(400).json({ error: "Insufficient points." });
        }

        await db.execute(`
            UPDATE user_points 
            SET total_points = total_points - $1,
                last_updated = CURRENT_TIMESTAMP
            WHERE user_id = $2`,
            [cost, userId]
        );

        await db.execute(`
            INSERT INTO point_transactions (user_id, points_change, activity_type, description, created_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [userId, -cost, 'Redemption', `Redeemed ${voucherName}`]
        );

        const voucherRes = await db.execute("SELECT id, stock FROM vouchers WHERE name = $1", [voucherName]);
        if (voucherRes.length === 0) {
            await db.execute('ROLLBACK');
            return res.status(404).json({ error: "Voucher not found" });
        }

        const currentStock = voucherRes[0].stock;
        if (currentStock < 5) {
            await db.execute('ROLLBACK');
            return res.status(400).json({ error: "Voucher is currently unavailable (low stock)." });
        }

        const voucherId = voucherRes[0].id;

        const updateRes = await db.execute(
            "UPDATE vouchers SET stock = stock - 1 WHERE id = $1 AND stock > 0",
            [voucherId]
        );

        if (updateRes.rowCount === 0) {
            await db.execute('ROLLBACK');
            return res.status(400).json({ error: "Sorry, out of stock!" });
        }

        await db.execute(`
            INSERT INTO user_inventory (user_id, voucher_id, item_name, quantity, status) 
            VALUES ($1, $2, $3, 1, 'inactive')`,
            [userId, voucherId, voucherName]
        );

        await db.execute('COMMIT');
        res.json({ success: true, message: `Successfully redeemed ${voucherName}!` });

    } catch (err) {
        await db.execute('ROLLBACK');
        console.error("Redeem Error:", err.message);
        res.status(500).json({ error: "Server error during redemption." });
    }
});

app.get("/api/get-point-history", ensureAuthenticated, async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await db.execute(
            `SELECT points_change, description, created_at
             FROM point_transactions 
             WHERE user_id = $1 
             ORDER BY created_at DESC`,
            [userId]
        );

        const history = result.rows || result;

        res.json(history);
    } catch (err) {
        console.error("Database Error:", err.message);
        res.status(500).json({ error: "Failed to fetch point history" });
    }
});

app.post("/api/update-avatar", ensureAuthenticated, uploadAvatar.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        const uploadToCloudinary = () =>
            new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: "user_avatars",
                        resource_type: "image",
                        public_id: `user_${req.user.id}_${Date.now()}`,
                        overwrite: true
                    },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    }
                );

                streamifier.createReadStream(req.file.buffer).pipe(stream);
            });

        const result = await uploadToCloudinary();
        const avatarUrl = result.secure_url;

        await db.execute(
            "UPDATE users SET profile_image = $1 WHERE id = $2",
            [avatarUrl, req.user.id]
        );

        if (req.user) {
            req.user.profile_image = avatarUrl;
        }

        res.json({
            success: true,
            avatarUrl: avatarUrl
        });
    } catch (err) {
        console.error("Avatar API Error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to upload avatar"
        });
    }
});

// G. 管理员权限
app.get("/api/admin/users", (req, res) => {
    if (req.isAuthenticated() && String(req.user.role).trim().toLowerCase() === 'admin') {

        const sql = `
            SELECT 
                u.id, 
                u.username, 
                u.email, 
                u.role, 
                u.is_verified,
                COALESCE(up.total_points, 0) AS total_points
            FROM users u
            LEFT JOIN user_points up ON u.id = up.user_id
            ORDER BY u.id ASC
        `;

        db.execute(sql)
            .then(users => {
                res.json({ success: true, users: users });
            })
            .catch(err => {
                console.error("Fetch Users Error:", err);
                res.status(500).json({ success: false, message: "Database error" });
            });
    } else {
        res.status(403).json({ success: false, message: "Unauthorized" });
    }
});

app.get("/api/admin/user-history/:userId", ensureAuthenticated, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false });

    const userId = Number(req.params.userId);

    if (isNaN(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    try {
        const history = await db.query(
            `SELECT points_change, activity_type, description, created_at 
             FROM point_transactions 
             WHERE user_id = $1 
             ORDER BY created_at DESC`,
            [userId]
        );

        res.json({ success: true, history: history });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put("/api/admin/edit-user/:id", async (req, res) => {
    const targetUserId = req.params.id;
    const { username, role } = req.body;

    try {
        if (!req.isAuthenticated() || String(req.user.role).trim().toLowerCase() !== 'admin') {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        const checkConflict = await db.execute(
            "SELECT id FROM users WHERE username = $1 AND id != $2", 
            [username, targetUserId]
        );

        if (checkConflict.length > 0) {
            return res.status(400).json({ success: false, message: "Username already taken by another user." });
        }

        await db.execute(
            "UPDATE users SET username = $1, role = $2 WHERE id = $3",
            [username, role, targetUserId]
        );

        res.json({ success: true, message: "User updated successfully!" });
    } catch (err) {
        console.error("Edit User Error:", err);
        res.status(500).json({ success: false, message: "Database update failed." });
    }
});

app.delete("/api/admin/delete-user/:id", async (req, res) => {
    const targetUserId = req.params.id;
    const adminId = req.user.id;

    try {
        if (!req.isAuthenticated() || String(req.user.role).trim().toLowerCase() !== 'admin') {
            return res.status(403).json({ success: false, message: "Access Denied." });
        }

        if (parseInt(targetUserId) === parseInt(adminId)) {
            return res.status(400).json({ success: false, message: "Access Denied.You can't delete your own account!" });
        }

        const result = await db.execute("DELETE FROM users WHERE id = $1", [targetUserId]);

        res.json({ success: true, message: `User ID ${targetUserId} deleted successfully` });
        console.log(`[Admin Action] Admin (ID: ${adminId}) deleted User (ID: ${targetUserId})`);

    } catch (err) {
        console.error("Delete User Error:", err.message);
        res.status(500).json({ success: false, message: "Delete failed. Database sync error" });
    }
});

app.get("/api/admin/vouchers", (req, res) => {
    if (req.isAuthenticated() && String(req.user.role).trim().toLowerCase() === 'admin') {
        db.execute("SELECT id, name, stock, cost, description FROM vouchers ORDER BY id ASC")
            .then(result => {
                let dataToSend = [];
                if (result.rows && Array.isArray(result.rows)) {
                    dataToSend = result.rows;
                } else if (Array.isArray(result)) {
                    dataToSend = result;
                } else if (result[0] && Array.isArray(result[0])) {
                    dataToSend = result[0];
                }

                res.json({ success: true, vouchers: dataToSend });
            })
            .catch(err => {
                console.error("Fetch Vouchers Error:", err);
                res.status(500).json({ success: false, message: "Database error", vouchers: [] });
            });
    }
    else {
        res.status(403).json({ success: false, message: "Unauthorized" });
    }
});

app.post('/api/admin/vouchers/bulk-delete', async (req, res) => {
    const { ids } = req.body;

    // Validation
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, message: "No IDs provided" });
    }

    try {
        const sql = "DELETE FROM vouchers WHERE id = ANY($1)";
        
        const result = await db.query(sql, [ids]);

        res.json({ 
            success: true, 
            message: `${result.rowCount} vouchers deleted successfully.` 
        });
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

app.post("/api/admin/add-voucher", async (req, res) => {
    const { name, stock, cost, description } = req.body;

    try {
        if (!req.isAuthenticated() || String(req.user.role).trim().toLowerCase() !== 'admin') {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        await db.execute(
            "INSERT INTO vouchers (name, stock, cost, description, created_at) VALUES ($1, $2, $3, $4, NOW())",
            [name, stock, cost, description]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Database Insert Error:", err.message);
        res.status(500).json({ success: false, message: "Database insert failed" });
    }
});

app.put("/api/admin/edit-voucher/:id", async (req, res) => {
    const targetVoucherId = req.params.id;
    const { name, stock, cost, description } = req.body;

    try {
        if (!req.isAuthenticated() || String(req.user.role).trim().toLowerCase() !== 'admin') {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        await db.execute(
            "UPDATE vouchers SET name = $1, stock = $2, cost = $3 , description = $4 WHERE id = $5",
            [name, stock, cost, description, targetVoucherId]
        );

        res.json({ success: true, message: "Voucher updated successfully!" });
    } catch (err) {
        console.error("Edit User Error:", err);
        res.status(500).json({ success: false, message: "Database update failed." });
    }
});

app.delete("/api/admin/delete-voucher/:id", async (req, res) => {
    const targetId = req.params.id;

    try {
        if (!req.isAuthenticated() || String(req.user.role).trim().toLowerCase() !== 'admin') {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        await db.execute("DELETE FROM vouchers WHERE id = $1", [targetId]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Database delete failed" });
    }
});

app.post("/api/admin/upload-vouchers-excel", upload.single("excelFile"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        let importCount = 0;

        for (const row of data) {
            const cleanRow = Object.keys(row).reduce((acc, key) => {
                acc[key.toLowerCase().trim()] = row[key];
                return acc;
            }, {});

            console.log("Cleaned Row Data:", cleanRow);

            const { name, stock, cost, description } = cleanRow;

            if (name && stock !== undefined && cost !== undefined) {
                try {
                    const formattedName = toTitleCase(name);
                    const formattedDesc = toTitleCase(description);
                    const sql = `
                        INSERT INTO vouchers (name, stock, cost, description, created_at) 
                        VALUES ($1, $2, $3, $4, NOW())
                        ON CONFLICT (name) 
                        DO UPDATE SET 
                            stock = vouchers.stock + EXCLUDED.stock,
                            cost = EXCLUDED.cost,
                            description = EXCLUDED.description
                    `;

                    await db.query(sql, [
                        formattedName,
                        parseInt(stock) || 0,
                        parseInt(cost) || 0,
                        formattedDesc
                    ]);

                    importCount++;
                } catch (rowErr) {
                    console.error(`Row Import Error (${name}):`, rowErr.message);
                }
            }
        }

        res.json({ success: true, count: importCount });

    } catch (err) {
        console.error("Upload Error:", err);
        res.status(500).json({ success: false, message: "Internal server error: " + err.message });
    }
});

app.get("/api/admin/analytics-data", ensureAuthenticated, async (req, res) => {
    if (!req.user || String(req.user.role).trim().toLowerCase() !== 'admin') {
        return res.status(403).json({ success: false, message: "No access." });
    }

    try {
        const range = parseInt(req.query.range) || 30;
        const userRes = await db.query("SELECT COUNT(*) as count FROM users");
        const voucherRes = await db.query("SELECT SUM(stock) as remaining_stock FROM vouchers");

        const scoreTypeRes = await db.query(`
            SELECT game_type, COUNT(*) as count 
            FROM scores 
            GROUP BY game_type
        `);

        const levelStats = await db.query(`
            SELECT reached_level, game_type, COUNT(*) as count 
            FROM scores 
            WHERE created_at > NOW() - INTERVAL '${range} days'
            GROUP BY reached_level, game_type
            ORDER BY reached_level ASC
        `);

        const trendStats = await db.query(`
            SELECT 
                DATE(d.day) as date, 
                s.game_type, 
                COUNT(s.id) as count 
            FROM (
                SELECT generate_series(CURRENT_DATE - INTERVAL '${range} days', CURRENT_DATE, '1 day') as day
            ) d
            LEFT JOIN scores s ON DATE(s.created_at) = DATE(d.day)
            GROUP BY DATE(d.day), s.game_type
            ORDER BY DATE(d.day) ASC
        `);

        const getRows = (res) => res.rows || res;

        const scoreRows = getRows(scoreTypeRes);
        let totalGames = 0;
        let finderGames = 0;
        let defenderGames = 0;

        scoreRows.forEach(row => {
            const count = parseInt(row.count) || 0;
            totalGames += count;
            if (row.game_type === 'RiskFinder') finderGames = count;
            if (row.game_type === 'RiskDefender') defenderGames = count;
        });

        res.json({
            success: true,
            summary: {
                users: getRows(userRes)[0]?.count || 0,
                gamesPlayed: totalGames,
                finderGames: finderGames,
                defenderGames: defenderGames,
                vouchersLeft: getRows(voucherRes)[0]?.remaining_stock || 0
            },
            levels: getRows(levelStats),
            trends: getRows(trendStats)
        });
    } catch (err) {
        console.error("Analytics API Error:", err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

setInterval(async () => {
    try {
        const result = await db.query(`
            DELETE FROM users 
            WHERE is_verified = 0 
            AND (
                reset_expires < NOW() 
                OR created_at < NOW() - INTERVAL '24 hours'
            )
        `);

        console.log(`[Cleanup] Run at: ${new Date().toLocaleString()}`);

        const deletedCount = result ? result.rowCount : 0;
        console.log(`[Cleanup] Unverified users removed: ${deletedCount}`);

    } catch (err) {
        console.error("[Cleanup Error]:", err.message);
    }
}, 30 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
});
