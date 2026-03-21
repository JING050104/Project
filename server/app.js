require('dotenv').config();
const express = require("express");
const session = require("express-session");
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const passport = require("passport");
const path = require("path");
const db = require("./db"); 
const authRoutes = require('./routes/auth'); 
const ensureAuthenticated = require("./middleware/auth"); //
const app = express();

// 1. 初始化 Passport 配置 (必须在路由之前)
require("./passport")(passport); //

// 2. 解析器：处理 JSON 和表单数据 (必须最先执行)
app.use(express.json()); //
app.use(express.urlencoded({ extended: true })); //

app.use(session({
    store: new pgSession({
        pool: db.pool,
        tableName: 'session',
        ttl: 86400,                   
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

// 4. 初始化 Passport (顺序固定)
app.use(passport.initialize()); //
app.use(passport.session()); //

// 5. 静态资源服务 (放在初始化之后，路由之前)
app.use(express.static(path.join(__dirname, "../public"))); //

// --- 6. 页面路由 ---

// 首页逻辑
app.get("/", (req, res) => {
    // 如果已经登录，直接跳转到仪表盘
    if (req.isAuthenticated && req.isAuthenticated()) {
        return res.redirect("/dashboard.html");
    }
    res.sendFile(path.join(__dirname, "../public/index.html")); //
});

// 保护的仪表盘路由
app.get("/dashboard.html", ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, "../public/dashboard.html")); //
});

// 身份验证路由 (登录、注册、注销)
app.use("/auth", authRoutes); //

// --- 7. REWARD & POINT 系统 API ---

/**
 * A. 获取用户当前积分
 */
app.get("/api/get-points", ensureAuthenticated, async (req, res) => {
    try {
        const rows = await db.execute("SELECT total_points FROM user_points WHERE user_id = $1", [req.user.id]);
        
        const points = rows[0] ? rows[0].total_points : 0;
        res.json({ points: points });
    } catch (err) {
        console.error("SQL Error:", err);
        res.status(500).json({ error: "Failed to fetch points." });
    }
});

app.get("/api/get-points", ensureAuthenticated, async (req, res) => {
    try {
        const rows = await db.execute("SELECT total_points FROM user_points WHERE user_id = $1", [req.user.id]);
        
        const points = rows[0] ? rows[0].total_points : 0;
        res.json({ points: points });
    } catch (err) {
        console.error("SQL Error:", err);
        res.status(500).json({ error: "Failed to fetch points." });
    }
});

/**
 * B. 大转盘奖励同步
 */
app.post("/api/spin-reward", ensureAuthenticated, async (req, res) => {
    const userId = req.user.id;
    const { reward } = req.body;

    console.log(`[Spin Debug] User ${userId} spinning, reward: ${reward}`);

    try {
        if (reward && reward.includes("pts")) {
            const points = parseInt(reward);

            await db.query('BEGIN');

            await db.query(`
                INSERT INTO user_points (user_id, total_points, last_updated) 
                VALUES ($1, $2, NOW() AT TIME ZONE 'Asia/Kuala_Lumpur')
                ON CONFLICT (user_id) 
                DO UPDATE SET 
                    total_points = user_points.total_points + $3,
                    last_updated = NOW() AT TIME ZONE 'Asia/Kuala_Lumpur'`, 
                [userId, points, points]
            );
            console.log("[Spin Debug] user_points updated");

            await db.query(`
                INSERT INTO point_transactions (user_id, points_change, activity_type, description) 
                VALUES ($1, $2, $3, $4)`,
                [userId, points, 'DAILY_SPIN', `Spin Win: ${reward}`]
            );
            console.log("[Spin Debug] point_transactions inserted");

            await db.query('COMMIT');
            return res.json({ success: true, type: 'points' });

        } else {
            console.log("[Spin Debug] No points in reward, skipping DB write.");
            return res.json({ success: false, error: "No points earned" });
        }
    } catch (err) {
        await db.query('ROLLBACK');
        console.error("[Spin Debug] CRITICAL ERROR:", err.message); 
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * C. 获取用户背包道具
 */
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
        const inventoryData = await db.execute(query, [req.user.id]);   // 現在直接得到 rows

        console.log("Sending Inventory to Frontend:", inventoryData); 
        res.json(inventoryData); 

    } catch (err) {
        console.error("Inventory Fetch Error:", err.message);
        res.status(500).json({ error: "Failed to load inventory" });
    }
});

/**
 * D. 激活/使用道具
 */
app.post('/api/activate-item', ensureAuthenticated, async (req, res) => {
    const userId = req.user.id;           // ← 重要！加上這一行
    const { inventoryId } = req.body;

    const activatedAt = new Date(); 
    const expiredAt = new Date(activatedAt.getTime() + 60 * 60 * 1000); // 1小時後過期

    try {
        const newCode = "CQ-" + Math.random().toString(36).substring(2, 8).toUpperCase();

        const result = await db.query(
            `UPDATE user_inventory 
            SET status = 'active', redeem_code = $1, expired_at = $2, activated_at = $3
            WHERE id = $4 AND user_id = $5 AND status = 'unused'`,
            [newCode, expiredAt, activatedAt, inventoryId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(400).json({ 
                error: "Item already activated, not found, or does not belong to you." 
            });
        }

        res.json({ 
            success: true, 
            redeemCode: newCode,
            expiredAt: expiredAt 
        });

    } catch (err) {
        console.error("Activation Error:", err);
        res.status(500).json({ error: "Activation failed." });
    }
});

/**
 * E. 保存游戏得分
 */
app.post("/api/save-score", ensureAuthenticated, async (req, res) => {
    const userId = req.user.id;
    const username = req.user.username || req.user.email;
    const { score, reached_level, gameType } = req.body; 

    try {
        await db.query('BEGIN');

        await db.query(`
            INSERT INTO user_points (user_id, total_points, last_updated) 
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                total_points = user_points.total_points + $3,
                last_updated = NOW()`, 
            [userId, score, score]
        );

        await db.query(`
            INSERT INTO scores (user_id, username, game_type, score, reached_level) 
            VALUES ($1, $2, $3, $4, $5)`,
            [userId, username, gameType, score, reached_level]
        );

        const description = `Finished ${gameType}: Level ${reached_level}`;
        await db.query(`
            INSERT INTO point_transactions (user_id, points_change, activity_type, description) 
            VALUES ($1, $2, $3, $4)`,
            [userId, score, 'GAME_EARN', description]
        );

        await db.query('COMMIT'); 
        res.json({ success: true, message: "All records updated successfully!" });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Transaction Error:", err.message);
        res.status(500).json({ success: false, error: "Failed to sync data." });
    }
});

app.get("/api/leaderboard", async (req, res) => {
    const { gameType } = req.query;

    try {
        const queryText = `
            SELECT username, score, reached_level, time_left
            FROM (
                SELECT DISTINCT ON (username) username, score, reached_level, time_left
                FROM scores 
                WHERE game_type = $1 
                ORDER BY username, score DESC
            ) AS user_high_scores
            ORDER BY score DESC 
            LIMIT 10
        `;

        const result = await db.query(queryText, [gameType]);

        const rows = result.rows || [];
        
        res.json(rows);
    } catch (err) {
        console.error("Leaderboard API Error:", err);
        res.status(500).json({ error: "Leaderboard error", details: err.message });
    }
});

/**
 * F. 兌換禮券 (扣除積分)
 */
app.post("/api/redeem-voucher", ensureAuthenticated, async (req, res) => {
    const userId = req.user.id;
    const { voucherName, cost } = req.body;

    if (!voucherName || cost == null) {
        return res.status(400).json({ error: "Missing voucherName or cost" });
    }

    try {
        await db.query('BEGIN');

        const existing = await db.query(
            `SELECT id FROM user_inventory 
             WHERE user_id = $1 
               AND item_name = $2 
               AND (status = 'unused' OR status = 'active')`,
            [userId, voucherName]
        );

        if (existing.rows.length > 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ 
                error: `You already have a ${voucherName} in your inventory!` 
            });
        }

        const pointRes = await db.query(
            `SELECT total_points FROM user_points WHERE user_id = $1`,
            [userId]
        );

        const currentPoints = pointRes.rows[0] ? pointRes.rows[0].total_points : 0;

        if (currentPoints < cost) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: "Insufficient points." });
        }

        await db.query(`
            UPDATE user_points 
            SET total_points = total_points - $1,
                last_updated = NOW() AT TIME ZONE 'Asia/Kuala_Lumpur'
            WHERE user_id = $2`,
            [cost, userId]
        );

        const voucherRes = await db.query(
            "SELECT id FROM vouchers WHERE name = $1", 
            [voucherName]
        );

        if (voucherRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: "Voucher not found" });
        }

        const voucherId = voucherRes.rows[0].id;

        await db.query(
            "UPDATE vouchers SET stock = stock - 1 WHERE id = $1",
            [voucherId]
        );

        await db.query(`
            INSERT INTO user_inventory 
                (user_id, voucher_id, item_name, quantity, status) 
            VALUES ($1, $2, $3, 1, 'unused') 
            ON CONFLICT (user_id, voucher_id) 
            DO UPDATE SET quantity = user_inventory.quantity + 1`,
            [userId, voucherId, voucherName]
        );

        await db.query('COMMIT');

        res.json({ 
            success: true, 
            message: `Successfully redeemed ${voucherName}!` 
        });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Redeem Error:", err.message);
        res.status(500).json({ error: "Server error during redemption." });
    }
});

setInterval(async () => {
    try {
        const [sessionResult, userResult] = await Promise.all([
            db.execute(`DELETE FROM session WHERE expire_timestamp < NOW()`),
            db.execute(`DELETE FROM users WHERE is_verified = 0 AND reset_expires < NOW()`)
        ]);

        console.log(`[Cleanup] ${sessionResult.rowCount || 0} expired sessions | ${userResult.rowCount || 0} unverified users`);
    } catch (err) {
        console.error("[Cleanup Error]:", err.message);
    }
}, 30 * 60 * 1000);

const PORT = process.env.PORT || 3000; 
// --- 8. 启动服务器 ---
// 优先使用云端分配的端口，如果本地运行则默认使用 3000
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running! Port: ${PORT}`); 
});