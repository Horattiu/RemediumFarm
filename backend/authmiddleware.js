const jwt = require("jsonwebtoken");
const logger = require("./logger");

const auth = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    // Log pentru debugging - verifică dacă cookies-urile sunt trimise
    logger.warn("Auth failed - No token in cookies", {
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection?.remoteAddress,
      hasCookies: !!req.cookies,
      cookieNames: req.cookies ? Object.keys(req.cookies) : [],
      headers: {
        cookie: req.headers.cookie ? "present" : "missing",
        origin: req.headers.origin,
        referer: req.headers.referer,
      }
    });
    return res.status(401).json({ 
      error: "Neautorizat - Te rog autentifică-te din nou",
      code: "NO_TOKEN"
    });
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
      tokenPresent: !!token,
      errorName: err.name,
      errorMessage: err.message,
    });
    
    // Mesaj mai clar în funcție de tipul de eroare
    let errorMessage = "Token invalid sau expirat";
    if (err.name === "TokenExpiredError") {
      errorMessage = "Sesiunea a expirat - Te rog autentifică-te din nou";
    } else if (err.name === "JsonWebTokenError") {
      errorMessage = "Token invalid - Te rog autentifică-te din nou";
    }
    
    return res.status(401).json({ 
      error: errorMessage,
      code: err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "TOKEN_INVALID"
    });
  }
};

module.exports = { auth };
