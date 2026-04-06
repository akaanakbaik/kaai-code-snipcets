'use strict';

/**
 * Vercel Serverless Function — /api/*
 *
 * The Express backend is pre-compiled to CommonJS by build-vercel.mjs
 * (run during Vercel's buildCommand) so @vercel/node does not need to
 * compile TypeScript or handle ESM packages like pino.
 */
const mod = require('../artifacts/api-server/dist/app.js');

// esbuild CJS output wraps ESM default export as module.exports.default
const app = (mod && typeof mod.default === 'function')
  ? mod.default
  : (typeof mod === 'function' ? mod : null);

if (!app) {
  console.error('[api/index.js] Failed to resolve Express app from dist/app.js');
}

module.exports = function handler(req, res) {
  return app(req, res);
};
