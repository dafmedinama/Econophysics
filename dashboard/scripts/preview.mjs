// Keep production-preview state in this checkout, including on Windows.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [require.resolve('wrangler/bin/wrangler.js'), 'dev',
  '--config', 'dist/server/wrangler.json', ...process.argv.slice(2)], {
  stdio: 'inherit', windowsHide: true,
  env: { ...process.env,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME ?? resolve('.wrangler/config'),
    WRANGLER_WRITE_LOGS: process.env.WRANGLER_WRITE_LOGS ?? 'false',
    WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH ?? resolve('.wrangler/logs'),
    WRANGLER_SEND_METRICS: process.env.WRANGLER_SEND_METRICS ?? 'false',
    MINIFLARE_REGISTRY_PATH: process.env.MINIFLARE_REGISTRY_PATH ?? resolve('.wrangler/registry'),
  },
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
