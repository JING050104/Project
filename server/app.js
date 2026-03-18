require('dotenv').config();
const express = require("express");
const session = require("express-session");
const pgSession = require('connect-pg-simple')(session);
const db = require("./db");
const passport = require("passport");
const path = require("path");
const authRoutes = require('./routes/auth'); 
const ensureAuthenticated = require("./middleware/auth"); 
const app = express();

// 1. 初始化 Passport 配置 (必须在路由之前)
require("./passport")(passport); //

// 2. 解析器：处理 JSON 和表单数据 (必须最先执行)
app.use(express.json()); //
app.use(express.urlencoded({ extended: true })); //

app.use(session({
    store: new pgSession({
        pool : db,                
        tableName : 'session'     
    }),
    key: 'fyp_session_cookie',
    secret: "fyp_secret", 
    resave: false, 
    saveUninitialized: false, 
    proxy: true, 
    cookie: {
        secure: false, 
        httpOnly: true, 
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 
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
        const [rows] = await db.query("SELECT total_points FROM user_points WHERE user_id = $1", [req.user.id]); //
        res.json({ points: rows[0] ? rows[0].total_points : 0 }); //
    } catch (err) {
        console.error("SQL Error:", err);
        res.status(500).json({ error: "Failed to fetch points." }); //
    }
});

app.get('/api/get-vouchers', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id, name, cost FROM vouchers');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Database error" });
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
                INSERT INTO user_points (user_id, total_points) 
                VALUES ($1, $2)
                ON CONFLICT (user_id) 
                DO UPDATE SET total_points = user_points.total_points + $3`, 
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
            i.status as "status" ,
            i.redeem_code as "redeem_code",
            v.description AS "description"
        FROM user_inventory i
        LEFT JOIN vouchers v ON i.voucher_id = v.id
        WHERE i.user_id = $1
    `;

    try {
        const result = await db.query(query, [req.user.id]);
        const inventoryData = result.rows ? result.rows : (Array.isArray(result) ? result : []);
        console.log("Sending Inventory to Frontend:", inventoryData); 
        res.json(inventoryData); 
    } catch (err) {
        console.error("Inventory Fetch Error:", err);
        res.status(500).json([]);
    }
});

/**
 * D. 激活/使用道具
 */
app.post('/api/activate-item', async (req, res) => {
    const { inventoryId } = req.body;
    const userId = req.user.id;

    try {
        const newCode = "CQ-" + Math.random().toString(36).substring(2, 8).toUpperCase();

        const result = await db.query(
            "UPDATE user_inventory SET status = 'active', redeem_code = $1 WHERE id = $2 AND user_id = $3 AND status = 'unused'",
            [newCode, inventoryId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(400).json({ error: "Item already activated or not found." });
        }

        res.json({ success: true, redeemCode: newCode });
    } catch (err) {
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
            INSERT INTO user_points (user_id, total_points) 
            VALUES ($1, $2)
            ON CONFLICT (user_id) 
            DO UPDATE SET total_points = user_points.total_points + $3`, 
            [userId, score, score]
        );

        await db.query(`
            INSERT INTO scores (user_id, username, game_type, score, reached_level, time_left) 
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, username, gameType, score, reached_level, time_left || 0]
        );

        const description = `Finished ${gameType}: Level ${reached_level}`;
        await db.query(`
            INSERT INTO point_transactions (user_id, points_change, activity_type, description) 
            VALUES ($1, $2, $3, $4)`,
            [userId, score, 'GAME_EARN', description]
        );

        await db.query('COMMIT');
        res.json({ success: true, message: "Score saved with time bonus!" });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/leaderboard", async (req, res) => {
    const { gameType } = req.query;

    try {
        const result = await db.query(`
            SELECT DISTINCT ON (username) username, score, reached_level, time_left
            FROM scores 
            WHERE game_type = $1 
            ORDER BY username, score DESC, reached_level DESC, time_left DESC, created_at ASC
        `, [gameType]);

        const sortedData = result.rows.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.reached_level !== a.reached_level) return b.reached_level - a.reached_level;
            return b.time_left - a.time_left; // 剩余时间多的在前
        });

        res.json(sortedData);
    } catch (err) {
        res.status(500).json({ error: "Leaderboard error" });
    }
});

/**
 * F. 兑换礼券 (扣除积分)
 */
app.post("/api/redeem-voucher", ensureAuthenticated, async (req, res) => {
    const userId = req.user.id;
    const { voucherName, cost } = req.body; 

    
    try {
        const [vResult] = await db.query("SELECT id FROM vouchers WHERE name = $1", [voucherName]);
        const voucherId = vResult[0].id;
        const [pResult] = await db.query("SELECT total_points FROM user_points WHERE user_id = $1", [userId]);
        if (!pResult[0] || pResult[0].total_points < cost) return res.status(400).json({ error: "Insufficient points." });

        await db.query("UPDATE user_points SET total_points = total_points - $1 WHERE user_id = $2", [cost, userId]);
        await db.query("UPDATE vouchers SET stock = stock - 1 WHERE id = $1", [voucherId]);
        await db.query(`
            INSERT INTO user_inventory (user_id, voucher_id, item_name, quantity, status) 
            VALUES ($1, $2, $3, 1, 'unused') 
            ON CONFLICT (user_id, voucher_id) 
            DO UPDATE SET quantity = user_inventory.quantity + 1`, 
            [userId, voucherId, voucherName] 
        );

        res.json({ success: true, message: `Successfully redeemed ${voucherName}!` });
    } catch (err) {
        console.error("Redeem Error:", err);
        res.status(500).json({ error: "Server error during redemption." });
    }
});

const PORT = process.env.PORT || 3000; 
setInterval(async () => {

    try {

        await db.execute(`
            DELETE FROM users
            WHERE is_verified = 0
            AND reset_expires < NOW()
        `);

        console.log("Expired unverified users cleaned");

    } catch(err) {

        console.error("Cleanup error:", err);

    }

}, 10 * 60 * 1000);

// --- 8. 启动服务器 ---
// 优先使用云端分配的端口，如果本地运行则默认使用 3000
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running! Port: ${PORT}`); 
});