/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');

// cPanel / Passenger startup file for a Next.js standalone build.
// The deploy workflow places Next's generated standalone server at:
//   .next/standalone/server.js
// and copies static assets to:
//   .next/standalone/.next/static
// plus public assets to:
//   .next/standalone/public

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const standaloneDir = path.join(__dirname, '.next', 'standalone');
const standaloneServer = path.join(standaloneDir, 'server.js');

if (!fs.existsSync(standaloneServer)) {
  console.error('Standalone server not found:', standaloneServer);
  console.error('Expected deployment to include `.next/standalone/server.js`.');
  process.exit(1);
}

// Next's standalone server expects to run with CWD set to the standalone directory.
process.chdir(standaloneDir);

// eslint-disable-next-line import/no-dynamic-require, global-require
require(standaloneServer);
