#!/usr/bin/env node
/**
 * Local re-extract for L5 + L8: read existing structural JSON from data/kb,
 * run the B1–B8 transforms, write the engine-ready JSON back. Used when no
 * NOTION_BUILD_API_KEY is available (cloud sessions; preview branches).
 *
 * Same transforms run on the Vercel build path via build-kb.mjs — this script
 * just lets us exercise them without re-fetching from Notion. The structural
 * intermediate is taken verbatim from the prior structural extraction
 * (committed in data/kb/structural/), so the snapshot side of the path is
 * fixed and the transform output is exclusively a function of that input.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import { transformLayer8, Layer8Records } from "./kb-transforms/transform-l8.mjs";
import { transformLayer5, Layer5Records } from "./kb-transforms/transform-l5.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const KB_DIR = join(REPO_ROOT, "data", "kb");
const STRUCT_DIR = join(KB_DIR, "structural");

function withContentHash(data) {
  const { layer, title, source_page_id, version, ...rest } = data;
  const forHash = { layer, title, source_page_id, ...(version ? { version } : {}), ...rest };
  const hash = createHash("sha256").update(JSON.stringify(forHash)).digest("hex");
  return {
    layer,
    title,
    source_page_id,
    content_hash: hash,
    ...(version ? { version } : {}),
    ...rest,
  };
}

async function run() {
  await mkdir(STRUCT_DIR, { recursive: true });
  const failures = [];

  // ---- L8 ----
  const l8StructPath = join(STRUCT_DIR, "layer-8.json");
  const l8Struct = JSON.parse(await readFile(l8StructPath, "utf8"));
  const l8meta = { layer: 8, title: l8Struct.title, source_page_id: l8Struct.source_page_id };
  try {
    const { exercises } = transformLayer8({ sections: l8Struct.sections });
    const candidate = withContentHash({ ...l8meta, version: "1.0", exercises });
    const parsed = Layer8Records.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      failures.push(`L8 schema: path=${issue.path.join(".")} msg=${issue.message}`);
      console.error(parsed.error.issues.slice(0, 3));
    } else {
      await writeFile(
        join(KB_DIR, "layer-8.json"),
        JSON.stringify(parsed.data, null, 2) + "\n",
        "utf8"
      );
      console.log(`[reextract] L8 OK: ${exercises.length} exercises`);
    }
  } catch (err) {
    failures.push(`L8 transform: ${err.message}`);
    console.error(err);
  }

  // ---- L5 ----
  const l5StructPath = join(STRUCT_DIR, "layer-5.json");
  const l5Struct = JSON.parse(await readFile(l5StructPath, "utf8"));
  const l5meta = { layer: 5, title: l5Struct.title, source_page_id: l5Struct.source_page_id };
  try {
    const { foundation, coupling_entries, warnings } = transformLayer5({
      sections: l5Struct.sections,
    });
    for (const w of warnings) console.log(`[reextract] L5 warning: ${w}`);
    const candidate = withContentHash({
      ...l5meta,
      version: "1.0",
      foundation,
      coupling_entries,
    });
    const parsed = Layer5Records.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      failures.push(`L5 schema: path=${issue.path.join(".")} msg=${issue.message}`);
      console.error(parsed.error.issues.slice(0, 3));
    } else {
      await writeFile(
        join(KB_DIR, "layer-5.json"),
        JSON.stringify(parsed.data, null, 2) + "\n",
        "utf8"
      );
      console.log(
        `[reextract] L5 OK: Foundation + ${coupling_entries.length} coupling entries`
      );
    }
  } catch (err) {
    failures.push(`L5 transform: ${err.message}`);
    console.error(err);
  }

  if (failures.length > 0) {
    console.error(`[reextract] ${failures.length} failure(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("[reextract] done");
}

run().catch((err) => {
  console.error("[reextract] FATAL:", err);
  process.exit(1);
});
