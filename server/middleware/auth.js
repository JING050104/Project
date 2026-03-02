function ensureAuthenticated(req, res, next) {
  // 使用 Passport 提供的 isAuthenticated() 方法
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  // 针对 API 请求的处理：返回 JSON 错误
  if (req.originalUrl.startsWith('/api')) {
    return res.status(401).json({ 
      error: "Session expired", 
      message: "Please login again" 
    });
  }

  // 针对页面请求的处理：重定向到登录页
  res.redirect("/index.html"); 
}

module.exports = ensureAuthenticated;