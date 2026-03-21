require('dotenv').config();
const express = require("express");
const session = require("express-session");
const pgSession = require('connect-pg-simple')(session);
const passport = require("passport");
const path = require("path");
const db = require("./db"); 
const authRoutes = require('./routes/auth'); 
const ensureAuthenticated = require("./middleware/auth");

const app = express();

require('./passport')(passport);

// ====================== 中間件 ======================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    store: new pgSession({
        pool: db.pool,
        tableName: 'session',
        ttl: 86400,                    // 24小時
        pruneSessionInterval: false,
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

app.use(express.static(path.join(__dirname, "../public")));

// ====================== 路由 ======================
app.get("/", (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect("/dashboard.html");
    }
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/dashboard.html", ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, "../public/dashboard.html"));
});

app.use("/auth", authRoutes);

// ====================== REWARD & POINT API ======================

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

// B. 大轉盤
app.post("/api/spin-reward", ensureAuthenticated, async (req, res) => {
    const userId = req.user.id;
    const { reward } = req.body;

    if (!reward || !reward.includes("pts")) {
        return res.json({ success: false, error: "No points earned" });
    }

    const points = parseInt(reward);

    try {
        await db.execute('BEGIN');

        await db.execute(`
            INSERT INTO user_points (user_id, total_points, last_updated) 
            VALUES ($1, $2, NOW() AT TIME ZONE 'Asia/Kuala_Lumpur')
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                total_points = user_points.total_points + $3,
                last_updated = NOW() AT TIME ZONE 'Asia/Kuala_Lumpur'`, 
            [userId, points, points]
        );

        await db.execute(`
            INSERT INTO point_transactions (user_id, points_change, activity_type, description) 
            VALUES ($1, $2, $3, $4)`,
            [userId, points, 'DAILY_SPIN', `Spin Win: ${reward}`]
        );

        await db.execute('COMMIT');
        res.json({ success: true, type: 'points' });

    } catch (err) {
        await db.execute('ROLLBACK');
        console.error("Spin Reward Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// C. 獲取背包（已修正）
app.get('/api/get-inventory', ensureAuthenticated, async (req, res) => {
    const query = `
        SELECT 
            i.id as "id", 
            COALESCE(v.name, i.item_name) as "item_name", 
            i.quantity as "quantity", 
            i.status as "status",
            i.redeem_code as "redeem_code",
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

// D. 激活道具（已修正 userId）
app.post('/api/activate-item', ensureAuthenticated, async (req, res) => {
    const userId = req.user.id;
    const { inventoryId } = req.body;

    const activatedAt = new Date();
    const expiredAt = new Date(activatedAt.getTime() + 60 * 60 * 1000);

    try {
        const newCode = "CQ-" + Math.random().toString(36).substring(2, 8).toUpperCase();

        const result = await db.execute(
            `UPDATE user_inventory 
             SET status = 'active', 
                 redeem_code = $1, 
                 expired_at = $2, 
                 activated_at = $3
             WHERE id = $4 AND user_id = $5 AND status = 'unused'`,
            [newCode, expiredAt, activatedAt, inventoryId, userId]
        );

        if (result.length === 0) {
            return res.status(400).json({ 
                error: "Item already activated, not found, or does not belong to you." 
            });
        }

        res.json({ 
            success: true, 
            redeemCode: newCode,
            expiredAt 
        });

    } catch (err) {
        console.error("Activation Error:", err);
        res.status(500).json({ error: "Activation failed." });
    }
});

// E. 保存遊戲得分
app.post("/api/save-score", ensureAuthenticated, async (req, res) => {
    const userId = req.user.id;
    const username = req.user.username || req.user.email;
    const { score, reached_level, gameType } = req.body; 

    try {
        await db.execute('BEGIN');

        await db.execute(`
            INSERT INTO user_points (user_id, total_points, last_updated) 
            VALUES ($1, $2, NOW() AT TIME ZONE 'Asia/Kuala_Lumpur')
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                total_points = user_points.total_points + $3,
                last_updated = NOW() AT TIME ZONE 'Asia/Kuala_Lumpur'`, 
            [userId, score, score]
        );

        await db.execute(`
            INSERT INTO scores (user_id, username, game_type, score, reached_level) 
            VALUES ($1, $2, $3, $4, $5)`,
            [userId, username, gameType, score, reached_level]
        );

        const description = `Finished ${gameType}: Level ${reached_level}`;
        await db.execute(`
            INSERT INTO point_transactions (user_id, points_change, activity_type, description) 
            VALUES ($1, $2, $3, $4)`,
            [userId, score, 'GAME_EARN', description]
        );

        await db.execute('COMMIT'); 
        res.json({ success: true, message: "All records updated successfully!" });
    } catch (err) {
        await db.execute('ROLLBACK');
        console.error("Save Score Error:", err.message);
        res.status(500).json({ success: false, error: "Failed to sync data." });
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

        // 檢查是否已擁有
        const existing = await db.execute(
            `SELECT id FROM user_inventory 
             WHERE user_id = $1 AND item_name = $2 
             AND (status = 'unused' OR status = 'active')`,
            [userId, voucherName]
        );

        if (existing.length > 0) {
            await db.execute('ROLLBACK');
            return res.status(400).json({ error: `You already have a ${voucherName}` });
        }

        // 檢查積分
        const pointRes = await db.execute("SELECT total_points FROM user_points WHERE user_id = $1", [userId]);
        const currentPoints = pointRes[0] ? pointRes[0].total_points : 0;

        if (currentPoints < cost) {
            await db.execute('ROLLBACK');
            return res.status(400).json({ error: "Insufficient points." });
        }

        // 扣積分
        await db.execute(`
            UPDATE user_points 
            SET total_points = total_points - $1,
                last_updated = NOW() AT TIME ZONE 'Asia/Kuala_Lumpur'
            WHERE user_id = $2`,
            [cost, userId]
        );

        // 取得 voucher_id
        const voucherRes = await db.execute("SELECT id FROM vouchers WHERE name = $1", [voucherName]);
        if (voucherRes.length === 0) {
            await db.execute('ROLLBACK');
            return res.status(404).json({ error: "Voucher not found" });
        }

        const voucherId = voucherRes[0].id;

        // 扣 stock
        await db.execute("UPDATE vouchers SET stock = stock - 1 WHERE id = $1", [voucherId]);

        // 加入背包
        await db.execute(`
            INSERT INTO user_inventory (user_id, voucher_id, item_name, quantity, status) 
            VALUES ($1, $2, $3, 1, 'unused') 
            ON CONFLICT (user_id, voucher_id) 
            DO UPDATE SET quantity = user_inventory.quantity + 1`,
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

// 清理任務
setInterval(async () => {
    try {
        const [sessionResult, userResult] = await Promise.all([
            db.execute(`DELETE FROM session WHERE expire_timestamp < NOW()`),
            db.execute(`DELETE FROM users WHERE is_verified = 0 AND reset_expires < NOW()`)
        ]);

        console.log(`[Cleanup] ${sessionResult.length || 0} expired sessions | ${userResult.length || 0} unverified users`);
    } catch (err) {
        console.error("[Cleanup Error]:", err.message);
    }
}, 30 * 60 * 1000);

// 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
});