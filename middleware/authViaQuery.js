const jwt = require("jsonwebtoken");

module.exports = function authQuery(req, res, next) {
  const token = req.query.token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "No token provided"
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid token"
    });
  }
};
