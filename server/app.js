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
            // 处理道具奖励 (例如: "XP Boost")
            await db.query(`
                INSERT INTO user_inventory (user_id, item_name, quantity) 
                VALUES ($1, $2, 1) 
                ON CONFLICT (user_id, item_name) 
                DO UPDATE SET quantity = user_inventory.quantity + 1`, 
                [userId, reward]
            );
            return res.json({ success: true, type: 'item' }); //
        }
    } catch (err) {
        console.error("Database Error during spin reward:", err.sqlMessage || err.message); //
        return res.status(500).json({ success: false, error: "Database sync failed." }); //
    }
});

/**
 * C. 获取用户背包道具
 */
app.get("/api/get-inventory", ensureAuthenticated, async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT item_name, quantity FROM user_inventory WHERE user_id = $1 AND quantity > 0", 
            [req.user.id]
        ); //
        res.json(rows); //
    } catch (err) {
        res.status(500).json({ error: err.message }); //
    }
});

/**
 * D. 激活/使用道具
 */
app.post("/api/activate-item", ensureAuthenticated, async (req, res) => {
    const userId = req.user.id; //
    const { itemName } = req.body; //

    try {
        const [rows] = await db.query(
            "SELECT quantity FROM user_inventory WHERE user_id = $1 AND item_name = $2", 
            [userId, itemName]
        ); //
        
        if (!rows[0] || rows[0].quantity <= 0) {
            return res.status(400).json({ error: "Item not found or empty." }); //
        }

        await db.query(
            "UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = $1 AND item_name = $2", 
            [userId, itemName]
        ); //
        
        res.json({ success: true, message: `${itemName} activated.` }); //
    } catch (err) {
        res.status(500).json({ error: err.message }); //
    }
});
/**
 * E. 保存 Risk Finder 游戏得分 (新增)
 */
app.post("/api/save-score", ensureAuthenticated, async (req, res) => {
    const userId = req.user.id; // 从 Passport 会话中获取用户 ID
    const { score } = req.body; // 获取前端发送的 totalScore

    console.log(`--- Game Score Received: User ${userId} earned ${score} points ---`);

    try {
        // 使用 INSERT ... ON DUPLICATE KEY UPDATE 确保积分累加
        await db.query(`
            INSERT INTO user_points (user_id, total_points) 
            VALUES ($1, $2)
            ON CONFLICT (user_id) 
            DO UPDATE SET total_points = user_points.total_points + $3`, 
            [userId, score, score]
        );
        res.json({ success: true, message: "Score successfully recorded!" });
    } catch (err) {
        // 如果报错，这里会在 Render Logs 里显示具体的红色错误
        console.error("Database Error during game score save:", err.message);
        res.status(500).json({ success: false, error: "Failed to sync score." });
    }
});

/**
 * F. 兑换礼券 (扣除积分)
 */
app.post("/api/redeem-voucher", ensureAuthenticated, async (req, res) => {
    const userId = req.user.id; //
    const { voucherName, cost } = req.body; //

    try {
        // 1. 检查用户积分是否足够
        const [rows] = await db.query("SELECT total_points FROM user_points WHERE user_id = $1", [userId]); //
        const currentPoints = rows[0] ? rows[0].total_points : 0;

        if (currentPoints < cost) {
            return res.status(400).json({ error: "Insufficient points." });
        }

        // 2. 扣除积分
        await db.query("UPDATE user_points SET total_points = total_points - $1 WHERE user_id = $2", [cost, userId]); //

        // 3. (可选) 这里你可以记录一条兑换历史到新表
        console.log(`--- Success: User ${userId} redeemed ${voucherName} for ${cost} pts ---`);

        res.json({ success: true, message: `Successfully redeemed ${voucherName}!` });
    } catch (err) {
        console.error("Redeem Error:", err);
        res.status(500).json({ error: "Server error during redemption." });
    }
});

// --- 8. 启动服务器 ---
// 优先使用云端分配的端口，如果本地运行则默认使用 3000
const PORT = process.env.PORT || 3000; 

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running! Port: ${PORT}`); 
});