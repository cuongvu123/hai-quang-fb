type Level = 'info' | 'warn' | 'error';

function log(level: Level, msg: string, meta?: unknown) {
  const line = {
    t: new Date().toISOString(),
    level,
    msg,
    ...(meta ? { meta } : {}),
  };
  // JSON line -> dễ thu thập bởi Vercel/Logflare/Datadog
  console[level === 'error' ? 'error' : 'log'](JSON.stringify(line));
}

export const logger = {
  info: (m: string, meta?: unknown) => log('info', m, meta),
  warn: (m: string, meta?: unknown) => log('warn', m, meta),
  error: (m: string, meta?: unknown) => log('error', m, meta),
};
