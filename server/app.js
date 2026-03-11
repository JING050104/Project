require('dotenv').config();
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const path = require("path");
const db = require("./db"); //
const authRoutes = require('./routes/auth'); //
const ensureAuthenticated = require("./middleware/auth"); //
const app = express();

// 1. 初始化 Passport 配置 (必须在路由之前)
require("./passport")(passport); //

// 2. 解析器：处理 JSON 和表单数据 (必须最先执行)
app.use(express.json()); //
app.use(express.urlencoded({ extended: true })); //

app.use(session({
    key: 'fyp_session_cookie',
    secret: "fyp_secret", 
    resave: false, 
    saveUninitialized: false, 
    proxy: true, 
        secure: false, 
        httpOnly: true, 
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 
    }
    ));


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
    const userId = req.user.id; //
    const { reward } = req.body; //

    console.log(`--- Spin Reward Sync: User ${userId} won ${reward} ---`); //

    try {
        if (reward.includes("pts")) {
            const points = parseInt(reward); //
            await db.query(`
                INSERT INTO user_points (user_id, total_points) 
                VALUES ($1, $2)
                ON CONFLICT (user_id) 
                DO UPDATE SET total_points = user_points.total_points + $3`, 
                [userId, points, points]
            ); //
            return res.json({ success: true, type: 'points' }); //
        } else {
            await db.query(`
                INSERT INTO user_inventory (user_id, voucher_id, item_name, quantity, status) 
                VALUES ($1, NULL, $2, 1, 'active') 
                ON CONFLICT (user_id, item_name) 
                DO UPDATE SET quantity = user_inventory.quantity + 1`, 
                [userId, reward] 
            );
            return res.json({ success: true, type: 'item' });
        }
    } catch (err) {
        console.error("Database Error during spin reward:", err.sqlMessage || err.message); //
        return res.status(500).json({ success: false, error: "Database sync failed." }); //
    }
});

/**
 * C. 获取用户背包道具
 */
app.get('/api/get-inventory', ensureAuthenticated, async (req, res) => {
    const userId = req.user.id; 
    try {
        const query = `
            SELECT 
                i.id, 
                COALESCE(v.name, i.item_name, 'Unknown Item') as item_name, 
                i.quantity, 
                i.status 
            FROM user_inventory i
            LEFT JOIN vouchers v ON i.voucher_id = v.id
            WHERE i.user_id = $1
        `;
        const result = await db.query(query, [userId]);
        
        // 关键修复：确保即使 result 是空的，也返回数组，且优先取 rows
        let data = [];
        if (result && result.rows) {
            data = result.rows;
        } else if (Array.isArray(result)) {
            data = result;
        }

        console.log(`Sending inventory for User ${userId}:`, data);
        res.json(data); 
    } catch (err) {
        console.error("Inventory Fetch Error:", err);
        res.status(500).json([]);
    }
});

/**
 * D. 激活/使用道具
 */
app.post("/api/activate-item", ensureAuthenticated, async (req, res) => {
    const userId = req.user.id;
    const { inventoryId } = req.body;

    try {
        const result = await db.query(
            "UPDATE user_inventory SET quantity = quantity - 1 WHERE id = $1 AND user_id = $2 AND quantity > 0", 
            [inventoryId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(400).json({ error: "Item not found or empty." });
        }

        res.json({ success: true, message: `Activated successfully.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * E. 保存 Risk Finder 游戏得分 (新增)
 */
app.post("/api/save-score", ensureAuthenticated, async (req, res) => {
    const userId = req.user.id;
    const { score } = req.body; 

    console.log(`--- Game Score Received: User ${userId} earned ${score} points ---`);

    try {
        await db.query(`
            INSERT INTO user_points (user_id, total_points) 
            VALUES ($1, $2)
            ON CONFLICT (user_id) 
            DO UPDATE SET total_points = user_points.total_points + $3`, 
            [userId, score, score]
        );
        res.json({ success: true, message: "Score successfully recorded!" });
    } catch (err) {
        console.error("Database Error during game score save:", err.message);
        res.status(500).json({ success: false, error: "Failed to sync score." });
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