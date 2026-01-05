const jwt = require("jsonwebtoken");
const logger = require("./logger");

const auth = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "Neautorizat" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, workplaceId, ... }
    next();
  } catch (err) {
    logger.error("Auth error - Token invalid sau expirat", err, {
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection?.remoteAddress,
    });
    return res.status(401).json({ error: "Token invalid sau expirat" });
  }
};

module.exports = { auth };
