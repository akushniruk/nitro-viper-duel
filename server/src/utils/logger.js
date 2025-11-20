/**
 * Professional logger utility with color-coded console outputs
 * Clean formatting without emojis for better compatibility
 */
import chalk from 'chalk';

// Log level configuration with colors
const LOG_LEVELS = {
  system: { color: chalk.bold.cyan, label: 'SYSTEM' },
  nitro: { color: chalk.bold.hex('#9900FF'), label: 'YELLOW NETWORK' },
  auth: { color: chalk.bold.hex('#FF8800'), label: 'AUTH' },
  ws: { color: chalk.bold.hex('#00AAFF'), label: 'WS' },
  game: { color: chalk.bold.hex('#00FF99'), label: 'GAME' },
  success: { color: chalk.bold.green, label: 'OK' },
  warn: { color: chalk.bold.yellow, label: 'WARN' },
  error: { color: chalk.bold.red, label: 'ERROR' },
  info: { color: chalk.bold.blue, label: 'INFO' },
  debug: { color: chalk.bold.magenta, label: 'DEBUG' },
  data: { color: chalk.hex('#888888'), label: 'DATA' }
};

// Timestamp generator with clean format
const timestamp = () => {
  const now = new Date();
  const time = now.toTimeString().split(' ')[0]; // HH:MM:SS format
  return chalk.dim(`[${time}]`);
};

// Format label with consistent width
const formatLabel = (config) => {
  const { color, label } = config;
  const paddedLabel = label.padEnd(8, ' ');
  return color(paddedLabel);
};

// Logger implementation
export const logger = {
  system: (message, ...args) => {
    console.log(timestamp(), formatLabel(LOG_LEVELS.system), message, ...args);
  },

  nitro: (message, ...args) => {
    console.log(timestamp(), formatLabel(LOG_LEVELS.nitro), message, ...args);
  },

  auth: (message, ...args) => {
    console.log(timestamp(), formatLabel(LOG_LEVELS.auth), message, ...args);
  },

  ws: (message, ...args) => {
    console.log(timestamp(), formatLabel(LOG_LEVELS.ws), message, ...args);
  },

  game: (message, ...args) => {
    console.log(timestamp(), formatLabel(LOG_LEVELS.game), message, ...args);
  },

  success: (message, ...args) => {
    console.log(timestamp(), formatLabel(LOG_LEVELS.success), chalk.green(message), ...args);
  },

  warn: (message, ...args) => {
    console.warn(timestamp(), formatLabel(LOG_LEVELS.warn), chalk.yellow(message), ...args);
  },

  error: (message, ...args) => {
    console.error(timestamp(), formatLabel(LOG_LEVELS.error), chalk.red(message), ...args);
  },

  info: (message, ...args) => {
    console.log(timestamp(), formatLabel(LOG_LEVELS.info), message, ...args);
  },

  debug: (message, ...args) => {
    console.debug(timestamp(), formatLabel(LOG_LEVELS.debug), chalk.dim(message), ...args);
  },

  // Special format for objects/data with better formatting
  data: (label, data) => {
    const formattedLabel = chalk.cyan.bold(label + ':');

    if (typeof data === 'object' && data !== null) {
      console.log(timestamp(), formatLabel(LOG_LEVELS.data), formattedLabel);
      console.log(chalk.dim(JSON.stringify(data, null, 2)));
    } else {
      console.log(timestamp(), formatLabel(LOG_LEVELS.data), formattedLabel, data);
    }
  },

  // Divider for visual separation
  divider: () => {
    console.log(chalk.dim('─'.repeat(80)));
  },

  // Section header
  section: (title) => {
    console.log();
    console.log(chalk.bold.white(`╭${'─'.repeat(78)}╮`));
    console.log(chalk.bold.white(`│ ${title.padEnd(77)}│`));
    console.log(chalk.bold.white(`╰${'─'.repeat(78)}╯`));
  }
};

export default logger;
