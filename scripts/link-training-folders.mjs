// Auto-link each app user to their subfolder under "Training Records" in the
// Health & Safety library, by fuzzy name match.
//
//   node scripts/link-training-folders.mjs [--dry]
//
// Prints matched / unmatched so you can fix the rest by hand in the app.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const env = {};
for (const line of readFileSync(
  path.join(process.cwd(), ".env.local"),
  "utf8",
).split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
const DRY = process.argv.includes("--dry");

const norm = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokens = (s) => norm(s).split(" ").filter(Boolean).sort().join(" ");

function lev(a, b) {
  const m = a.length,
    n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return d[m][n];
}

// ---- data ----
const { data: trFolder } = await sb
  .from("hs_folders")
  .select("id, name")
  .ilike("name", "%training records%")
  .order("name")
  .limit(1)
  .maybeSingle();
if (!trFolder) {
  console.error('No "Training Records" folder found in the H&S library.');
  process.exit(1);
}
const { data: folders } = await sb
  .from("hs_folders")
  .select("id, name")
  .eq("parent_id", trFolder.id);
const { data: users } = await sb
  .from("users")
  .select("id, full_name, active")
  .eq("active", true);
const { data: existing } = await sb
  .from("hs_person_folders")
  .select("user_id");
const already = new Set((existing ?? []).map((r) => r.user_id));

// ---- match ----
const matched = [];
const unmatchedUsers = [];
const usedFolders = new Set();

for (const u of users ?? []) {
  if (already.has(u.id)) {
    matched.push([u.full_name, "(already linked)"]);
    continue;
  }
  const un = norm(u.full_name);
  const ut = tokens(u.full_name);
  let hit = folders.find((f) => norm(f.name) === un && !usedFolders.has(f.id));
  if (!hit)
    hit = folders.find((f) => tokens(f.name) === ut && !usedFolders.has(f.id));
  if (!hit) {
    let best = null;
    let bestD = 3;
    for (const f of folders) {
      if (usedFolders.has(f.id)) continue;
      const d = lev(un, norm(f.name));
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    hit = best;
  }
  if (hit) {
    usedFolders.add(hit.id);
    matched.push([u.full_name, hit.name]);
    if (!DRY)
      await sb
        .from("hs_person_folders")
        .upsert({ user_id: u.id, folder_id: hit.id, updated_at: new Date().toISOString() });
  } else {
    unmatchedUsers.push(u.full_name);
  }
}

const unmatchedFolders = folders
  .filter((f) => !usedFolders.has(f.id))
  .map((f) => f.name);

console.log(`\n=== ${DRY ? "DRY RUN — " : ""}linked ${matched.length} ===`);
for (const [u, f] of matched) console.log(`  ${u.padEnd(24)} -> ${f}`);
console.log(`\n--- people with no folder (${unmatchedUsers.length}) ---`);
for (const u of unmatchedUsers) console.log(`  ${u}`);
console.log(`\n--- folders not matched to a person (${unmatchedFolders.length}) ---`);
for (const f of unmatchedFolders) console.log(`  ${f}`);
console.log("\nFix the stragglers on each person's Training page in the app.");
