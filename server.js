/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');

// Prefer Next.js standalone output when available (recommended for cPanel).
// When `next.config.mjs` sets `output: 'standalone'`, Next generates:
//   .next/standalone/server.js
// plus a minimal `node_modules/` bundle inside `.next/standalone/`.
const standaloneServer = path.join(__dirname, '.next', 'standalone', 'server.js');

if (fs.existsSync(standaloneServer)) {
  // The standalone server is a complete Node entrypoint.
  // Running it from here keeps cPanel's "startup file" simple.
  // eslint-disable-next-line import/no-dynamic-require, global-require
  require(standaloneServer);
} else {
  // Fallback: run Next's built-in server (requires `npm install` on the server).
  const http = require('node:http');
  const next = require('next');

  const port = Number.parseInt(process.env.PORT || '3000', 10);
  const hostname = process.env.HOSTNAME || '0.0.0.0';
  const dev = process.env.NODE_ENV !== 'production';

  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  app
    .prepare()
    .then(() => {
      http
        .createServer((req, res) => handle(req, res))
        .listen(port, hostname, () => {
          console.log(`> Ready on http://${hostname}:${port}`);
        });
    })
    .catch((err) => {
      console.error('Failed to start server', err);
      process.exit(1);
    });
}
