'use strict';

/**
 * Vercel Serverless Function — handles /api/*
 *
 * The Express backend is pre-compiled to CommonJS by
 * artifacts/api-server/build-vercel.mjs during Vercel's buildCommand.
 * Output is at _dist_server/app.js (project root) so Vercel's file
 * tracer reliably includes it in the serverless function bundle.
 */

console.log('[api/index.js] Loading Express bundle...');

let app;

try {
  const mod = require('../_dist_server/app.js');

  console.log('[api/index.js] Bundle loaded, mod type:', typeof mod);
  console.log('[api/index.js] mod.default type:', typeof mod.default);

  if (typeof mod === 'function') {
    app = mod;
  } else if (typeof mod.default === 'function') {
    app = mod.default;
  } else if (mod && mod.app && typeof mod.app === 'function') {
    app = mod.app;
  } else {
    throw new Error(
      'App export not found. mod type=' + typeof mod +
      ', mod.default type=' + typeof (mod && mod.default)
    );
  }

  console.log('[api/index.js] Express app resolved successfully, type:', typeof app);
} catch (err) {
  console.error('[api/index.js] FATAL: Failed to load Express bundle:', err.message);
  console.error(err.stack);
  // app remains undefined — handler below will return 500
}

module.exports = function handler(req, res) {
  if (!app) {
    console.error('[api/index.js] Handler called but app is not initialized');
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Server initialization failed' }));
    return;
  }

  try {
    return app(req, res);
  } catch (err) {
    console.error('[api/index.js] Handler crash:', err.message);
    console.error(err.stack);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }
};
