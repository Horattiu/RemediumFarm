const fs = require('fs');
const path = require('path');

// File logging (activat prin ENABLE_FILE_LOGGING=true)
const ENABLE_FILE_LOGGING = process.env.ENABLE_FILE_LOGGING === 'true';
const LOGS_DIR = path.join(__dirname, 'logs');

// Creează folderul logs dacă nu există și dacă file logging este activat
if (ENABLE_FILE_LOGGING && !fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Helper pentru a obține numele fișierului de log (un fișier pe zi)
const getLogFileName = () => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(LOGS_DIR, `app-${today}.log`);
};

// Helper pentru a scrie în fișier (async, fără să blocheze request-urile)
const writeToFile = (logLine) => {
  if (!ENABLE_FILE_LOGGING) return;
  
  try {
    const logFile = getLogFileName();
    // IMPORTANT: nu folosim appendFileSync (blochează event loop-ul).
    // Scriem async și ignorăm erorile ca să nu afecteze aplicația.
    fs.appendFile(logFile, logLine + '\n', 'utf8', (err) => {
      if (err) {
        console.error('⚠️ File logging error:', err.message);
      }
    });
  } catch (err) {
    // Nu vrem să blocăm aplicația dacă scrierea în fișier eșuează
    console.error('⚠️ File logging error:', err.message);
  }
};

// Helper pentru a formata logul pentru fișier
const formatLogLine = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  const dataStr = Object.keys(data).length > 0 ? ' ' + JSON.stringify(data) : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
};

const logger = {
  info: (message, data = {}) => {
    console.log('ℹ️', message, Object.keys(data).length > 0 ? data : '');
    // Scrie în fișier
    writeToFile(formatLogLine('info', message, data));
  },
  error: (message, error = null, context = {}) => {
    console.error('❌', message, error ? error.message : '', Object.keys(context).length > 0 ? context : '');
    
    // Scrie în fișier (cu detalii despre eroare)
    const fileData = { ...context };
    if (error) {
      fileData.error = {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
    }
    writeToFile(formatLogLine('error', message, fileData));
  },
  warn: (message, data = {}) => {
    console.warn('⚠️', message, Object.keys(data).length > 0 ? data : '');
    // Scrie în fișier
    writeToFile(formatLogLine('warn', message, data));
  },
  debug: (message, data = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('🔍', message, Object.keys(data).length > 0 ? data : '');
      // Scrie în fișier (doar în development)
      writeToFile(formatLogLine('debug', message, data));
    }
  }
};

module.exports = logger;
