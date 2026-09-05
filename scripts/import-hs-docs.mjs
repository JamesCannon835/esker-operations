// One-time bulk import of the Dropbox "Esker Readymix" H&S folder into the
// hs_folders / hs_documents tables + the `documents` storage bucket.
//
//   node scripts/import-hs-docs.mjs [--dry] [--root "<path>"]
//
// Idempotent: reuses folders by (name, parent) and skips files that already
// have an hs_documents row for the same (folder, name). Safe to re-run to
// pick up failures.

import { createClient } from "@supabase/supabase-js";
import { readFile, readdir, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import process from "node:process";

// ---- config -------------------------------------------------------------
const DEFAULT_ROOT = "C:\\Users\\james\\Dropbox\\Esker Readymix";
const BUCKET = "documents";
const PREFIX = "hs";
const CONCURRENCY = 5;
const MAX_BYTES = 40 * 1024 * 1024; // skip anything bigger (archival / cloud-only)

// Top-level folder names to skip entirely.
const SKIP_FOLDERS = new Set(["12. Sub-Contractors"]);

// Files to ignore anywhere.
const SKIP_FILE = (name) =>
  name === "desktop.ini" ||
  name === "Thumbs.db" ||
  name === ".DS_Store" ||
  name.startsWith("~$") ||
  name.startsWith(".~") ||
  name.endsWith(".tmp");

const CONTENT_TYPES = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
  url: "text/plain",
  msg: "application/vnd.ms-outlook",
  txt: "text/plain",
  csv: "text/csv",
};

// ---- env --------------------------------------------------------------
function loadEnv() {
  const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const rootIdx = args.indexOf("--root");
const ROOT = rootIdx >= 0 ? args[rootIdx + 1] : DEFAULT_ROOT;

// ---- helpers ---------------------------------------------------------
function sortOrderFromName(name) {
  const m = name.match(/^(\d+)[.\s]/);
  return m ? parseInt(m[1], 10) : 500;
}
function sanitise(name) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "file";
}
function uuid() {
  return randomUUID();
}

const stats = {
  folders: 0,
  uploaded: 0,
  skipped: 0,
  failed: 0,
  bytes: 0,
  cloudOnly: [],
  errors: [],
};

// folder cache: `${parentId ?? "root"}::${name}` -> id
const folderCache = new Map();

async function ensureFolder(name, parentId) {
  const key = `${parentId ?? "root"}::${name}`;
  if (folderCache.has(key)) return folderCache.get(key);
  if (DRY) {
    folderCache.set(key, `dry-${key}`);
    stats.folders++;
    return `dry-${key}`;
  }

  let q = supabase.from("hs_folders").select("id").eq("name", name);
  q = parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null);
  const { data: existing } = await q.maybeSingle();
  if (existing) {
    folderCache.set(key, existing.id);
    return existing.id;
  }
  if (DRY) {
    const fake = `dry-${key}`;
    folderCache.set(key, fake);
    stats.folders++;
    return fake;
  }
  const { data, error } = await supabase
    .from("hs_folders")
    .insert({
      name,
      parent_id: parentId,
      sort_order: sortOrderFromName(name),
    })
    .select("id")
    .single();
  if (error) throw new Error(`folder "${name}": ${error.message}`);
  folderCache.set(key, data.id);
  stats.folders++;
  return data.id;
}

async function fileAlreadyImported(folderId, name) {
  if (DRY) return false;
  const { data } = await supabase
    .from("hs_documents")
    .select("id")
    .eq("folder_id", folderId)
    .eq("name", name)
    .maybeSingle();
  return !!data;
}

async function importFile(absPath, name, folderId) {
  const info = await stat(absPath);
  const allocated = (info.blocks ?? 0) * 512;
  // Dropbox online-only placeholder: large logical size, ~nothing on disk.
  const cloudOnly = info.size > 1_048_576 && allocated < info.size * 0.5;
  if (cloudOnly || info.size > MAX_BYTES) {
    stats.cloudOnly.push(
      `${absPath}  (${(info.size / 1048576).toFixed(1)} MB${cloudOnly ? ", not downloaded" : ""})`,
    );
    return;
  }
  if (await fileAlreadyImported(folderId, name)) {
    stats.skipped++;
    return;
  }
  if (DRY) {
    stats.uploaded++;
    stats.bytes += info.size;
    return;
  }

  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const objectPath = `${PREFIX}/${folderId}/${uuid()}-${sanitise(name)}`;
  const body = await readFile(absPath);

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, body, {
      contentType: CONTENT_TYPES[ext] ?? "application/octet-stream",
      upsert: false,
    });
  if (upErr) throw new Error(`upload ${name}: ${upErr.message}`);

  const { error: dbErr } = await supabase.from("hs_documents").insert({
    folder_id: folderId,
    name,
    file_path: objectPath,
    file_size: info.size,
    content_type: CONTENT_TYPES[ext] ?? null,
  });
  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([objectPath]);
    throw new Error(`db ${name}: ${dbErr.message}`);
  }

  stats.uploaded++;
  stats.bytes += info.size;
}

// simple concurrency pool
async function pool(items, worker, size) {
  const queue = [...items];
  const runners = Array.from({ length: size }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function walk(dir, parentId, depth) {
  const entries = await readdir(dir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  const files = entries.filter((e) => e.isFile() && !SKIP_FILE(e.name));

  // files in this folder
  await pool(
    files,
    async (f) => {
      try {
        await importFile(path.join(dir, f.name), f.name, parentId);
      } catch (e) {
        stats.failed++;
        stats.errors.push(`${path.join(dir, f.name)} :: ${e.message}`);
      }
      const total = stats.uploaded + stats.skipped + stats.failed;
      if (total % 25 === 0) {
        console.log(
          `  ${total} files — ${stats.uploaded} up, ${stats.skipped} skip, ${stats.failed} fail, ${(stats.bytes / 1048576).toFixed(0)} MB`,
        );
      }
    },
    CONCURRENCY,
  );

  // subfolders
  for (const d of dirs) {
    if (depth === 0 && SKIP_FOLDERS.has(d.name)) {
      console.log(`skip folder: ${d.name}`);
      continue;
    }
    const childId = await ensureFolder(d.name, parentId);
    console.log(`${"  ".repeat(depth + 1)}${d.name}`);
    await walk(path.join(dir, d.name), childId, depth + 1);
  }
}

// ---- go -------------------------------------------------------------
console.log(`${DRY ? "[DRY RUN] " : ""}Importing from: ${ROOT}\n`);
const t0 = Date.now();
await walk(ROOT, null, 0);

console.log("\n=== DONE ===");
console.log(`folders:  ${stats.folders}`);
console.log(`uploaded: ${stats.uploaded}  (${(stats.bytes / 1048576).toFixed(1)} MB)`);
console.log(`skipped:  ${stats.skipped} (already imported)`);
console.log(`failed:   ${stats.failed}`);
console.log(`cloud-only (not on disk, left out): ${stats.cloudOnly.length}`);
for (const c of stats.cloudOnly) console.log(`   - ${c}`);
if (stats.errors.length) {
  console.log("\nErrors:");
  for (const e of stats.errors.slice(0, 40)) console.log(`   - ${e}`);
}
console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)}s`);
