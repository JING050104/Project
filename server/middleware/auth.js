function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  if (req.originalUrl.startsWith('/api')) {
    return res.status(401).json({
      error: "Session expired",
      message: "Please login again"
    });
  }

  res.redirect("/index.html");
}

module.exports = ensureAuthenticated;