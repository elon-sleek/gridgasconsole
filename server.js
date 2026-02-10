/* eslint-disable no-console */
/**
 * cPanel / Passenger startup file for a Next.js standalone build.
 *
 * The GitHub Actions deploy workflow copies the standalone output
 * (which includes its own server.js + node_modules + .next) into the
 * deploy root, then overwrites server.js with this wrapper.
 *
 * Layout on the server (CPANEL_DEPLOY_PATH):
 *   server.js          ← this file (cPanel "Application startup file")
 *   node_modules/      ← minimal bundle from standalone build
 *   .next/             ← compiled app + static assets
 *   public/            ← static public assets
 */

const path = require('node:path');

// Ensure Next.js finds its compiled output relative to this file.
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.chdir(__dirname);

// The standalone build generates its own server.js inside .next/standalone/.
// After our deploy flattens the structure, the Next internal server entry
// lives at __dirname/.next/standalone/server.js  OR  the standalone output's
// own next/dist server is bootstrapped by __dirname/node_modules/...
//
// The simplest approach: Next standalone output already placed a working
// server.js at the root of the standalone folder. Our deploy copies it as
// deploy/server.js and then we overwrite it with THIS file.
// So the original Next server.js was saved as _next_server.js by the workflow,
// or we can just start the http server ourselves using next.

const http = require('node:http');

const port = parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOSTNAME || '0.0.0.0';

// Next standalone output puts the compiled Next.js server handler here:
const NextServer = require('next/dist/server/next-server').default;

const app = new NextServer({
  hostname,
  port,
  dir: __dirname,
  dev: false,
  customServer: true,
  conf: require('./.next/required-server-files.json').config,
});

const handler = app.getRequestHandler();

http
  .createServer((req, res) => handler(req, res))
  .listen(port, hostname, () => {
    console.log(`> GridGas Console ready on http://${hostname}:${port}`);
  });
