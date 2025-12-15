import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'worker.log');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function rotateLogIfNeeded() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > MAX_LOG_SIZE) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        fs.renameSync(LOG_FILE, path.join(LOG_DIR, `worker-${timestamp}.log`));
      }
    }
  } catch (err) {
    // Ignore rotation errors
  }
}

function formatMessage(level, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

function writeToFile(message) {
  try {
    rotateLogIfNeeded();
    fs.appendFileSync(LOG_FILE, message + '\n');
  } catch (err) {
    // Silently fail file writes
  }
}

export const logger = {
  info(message) {
    const formatted = formatMessage('INFO', message);
    console.log(message);
    writeToFile(formatted);
  },

  error(message) {
    const formatted = formatMessage('ERROR', message);
    console.error(message);
    writeToFile(formatted);
  },

  warn(message) {
    const formatted = formatMessage('WARN', message);
    console.warn(message);
    writeToFile(formatted);
  },

  debug(message) {
    if (process.env.DEBUG === 'true') {
      const formatted = formatMessage('DEBUG', message);
      console.log(message);
      writeToFile(formatted);
    }
  }
};

export default logger;
