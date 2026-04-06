/**
 * Push new flat structure to Vercel GitHub repo.
 * Uses GitHub Trees API for bulk commit.
 *
 * Usage: VERCEL_GITHUB_TOKEN=xxx node scripts/push-to-vercel.mjs
 */

import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";

const OWNER = "akaanakbaik";
const REPO  = "kaai-code-snipcets";
const BRANCH = "main";
const TOKEN = process.env.VERCEL_GITHUB_TOKEN;

if (!TOKEN) {
  console.error("❌ VERCEL_GITHUB_TOKEN is not set");
  process.exit(1);
}

const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
const HEADERS = {
  Authorization: `token ${TOKEN}`,
  "Content-Type": "application/json",
  "User-Agent": "kaai-push-script",
  Accept: "application/vnd.github.v3+json",
};

async function ghFetch(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, { ...options, headers: { ...HEADERS, ...(options.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status} ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// Files to push: [localPath, remotePath]
const FILES = [
  // Root configs + entry HTML
  ["package.json",           "package.json"],
  ["tsconfig.json",          "tsconfig.json"],
  ["tsconfig.server.json",   "tsconfig.server.json"],
  ["vite.config.ts",         "vite.config.ts"],
  ["postcss.config.js",      "postcss.config.js"],
  ["drizzle.config.ts",      "drizzle.config.ts"],
  ["components.json",        "components.json"],
  ["vercel.json",            "vercel.json"],
  ["README.md",              "README.md"],
  ["index.html",             "index.html"],

  // API serverless entry
  ["api/index.js",           "api/index.js"],

  // Build script
  ["scripts/build-server.mjs", "scripts/build-server.mjs"],

  // Server lib
  ["server/lib/logger.ts",   "server/lib/logger.ts"],
  ["server/lib/schema.ts",   "server/lib/schema.ts"],
  ["server/lib/db.ts",       "server/lib/db.ts"],
  ["server/lib/mailer.ts",   "server/lib/mailer.ts"],
  ["server/lib/sync.ts",     "server/lib/sync.ts"],

  // Server middleware
  ["server/middleware/security.ts",       "server/middleware/security.ts"],
  ["server/middleware/api-key.ts",        "server/middleware/api-key.ts"],
  ["server/middleware/request-logger.ts", "server/middleware/request-logger.ts"],

  // Server routes
  ["server/routes/health.ts",   "server/routes/health.ts"],
  ["server/routes/stats.ts",    "server/routes/stats.ts"],
  ["server/routes/snippets.ts", "server/routes/snippets.ts"],
  ["server/routes/api-keys.ts", "server/routes/api-keys.ts"],
  ["server/routes/admin.ts",    "server/routes/admin.ts"],
  ["server/routes/index.ts",    "server/routes/index.ts"],

  // Server app
  ["server/app.ts",    "server/app.ts"],
  ["server/index.ts",  "server/index.ts"],
];

// Add all src/ files dynamically
import { readdirSync, statSync } from "fs";

function collectSrcFiles(dir, base = "") {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const relPath = base ? `${base}/${entry}` : entry;
    if (statSync(fullPath).isDirectory()) {
      collectSrcFiles(fullPath, relPath);
    } else {
      FILES.push([`src/${relPath}`, `src/${relPath}`]);
    }
  }
}

collectSrcFiles("src");

async function createBlob(content) {
  return ghFetch("/git/blobs", {
    method: "POST",
    body: JSON.stringify({ content, encoding: "base64" }),
  });
}

async function run() {
  console.log(`\n🚀 Pushing ${FILES.length} files to ${OWNER}/${REPO}...\n`);

  // Get current branch ref
  const refData = await ghFetch(`/git/ref/heads/${BRANCH}`);
  const currentSha = refData.object.sha;
  console.log(`📌 Current HEAD: ${currentSha.slice(0, 8)}`);

  // Get current commit tree
  const commitData = await ghFetch(`/git/commits/${currentSha}`);
  const baseTreeSha = commitData.tree.sha;
  console.log(`🌳 Base tree: ${baseTreeSha.slice(0, 8)}`);

  // Create blobs and build tree
  const treeEntries = [];
  let pushed = 0;

  for (const [localPath, remotePath] of FILES) {
    if (!existsSync(localPath)) {
      console.warn(`  ⚠️  Skip (not found): ${localPath}`);
      continue;
    }

    const raw = readFileSync(localPath);
    const content = raw.toString("base64");

    try {
      const blob = await createBlob(content);
      treeEntries.push({ path: remotePath, mode: "100644", type: "blob", sha: blob.sha });
      pushed++;
      process.stdout.write(`  ✅ ${remotePath}\n`);
    } catch (err) {
      console.error(`  ❌ ${remotePath}: ${err.message}`);
    }
  }

  if (treeEntries.length === 0) {
    console.error("❌ No files to push");
    process.exit(1);
  }

  // Create new tree
  console.log(`\n🌲 Creating tree with ${treeEntries.length} entries...`);
  const newTree = await ghFetch("/git/trees", {
    method: "POST",
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
  });

  // Create commit
  const now = new Date().toISOString();
  const newCommit = await ghFetch("/git/commits", {
    method: "POST",
    body: JSON.stringify({
      message: `refactor: flat structure — npm + Node.js v22 (${now.slice(0, 16)})`,
      tree: newTree.sha,
      parents: [currentSha],
    }),
  });

  // Update ref
  await ghFetch(`/git/refs/heads/${BRANCH}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: newCommit.sha, force: false }),
  });

  console.log(`\n✅ Pushed ${pushed} files`);
  console.log(`🔗 Commit: ${newCommit.sha.slice(0, 8)}`);
  console.log(`📦 https://github.com/${OWNER}/${REPO}/commit/${newCommit.sha}`);
}

run().catch((err) => {
  console.error("❌ Push failed:", err.message);
  process.exit(1);
});
