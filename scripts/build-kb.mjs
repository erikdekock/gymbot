#!/usr/bin/env node
/**
 * KB → JSON build-time pipeline (12.1, Tier A; 12.1b extension).
 *
 * Reads Kennisbank from Notion, validates per-layer schemas, writes
 * data/kb/layer-{N}.json. Runs in `vercel-build` hook. Fails non-zero on any
 * schema violation, with layer + field reported.
 *
 * Source: Notion REST via @notionhq/client when NOTION_BUILD_API_KEY is set
 * (production / Vercel build path). Alternatively KB_SNAPSHOT_FILE may point
 * at a pre-fetched JSON snapshot for local commit-time regeneration; both
 * paths feed identical block shapes into the same extractors — extractors and
 * schemas are the single source of truth for output shape.
 */
import { Client } from "@notionhq/client";
import { z } from "zod";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const KB_OUT_DIR = join(REPO_ROOT, "data", "kb");

// Kennisbank root page in Notion (not a secret).
const KB_PAGE_ID = "3584fef0d1ea8130a745f81cac3a895a";

// ---------- fetch source: Notion API or snapshot ----------

let listChildren;
if (process.env.KB_SNAPSHOT_FILE) {
  const snap = JSON.parse(await readFile(process.env.KB_SNAPSHOT_FILE, "utf8"));
  const childMap = snap.childMap ?? {};
  const topLevel = snap.topLevel ?? [];
  listChildren = async (blockId) => {
    if (blockId === KB_PAGE_ID) return topLevel;
    return childMap[blockId] ?? [];
  };
  console.log(`[build-kb] source: snapshot file ${process.env.KB_SNAPSHOT_FILE}`);
} else {
  const apiKey = process.env.NOTION_BUILD_API_KEY;
  if (!apiKey) {
    console.error("[build-kb] FATAL: NOTION_BUILD_API_KEY not set (and no KB_SNAPSHOT_FILE)");
    process.exit(1);
  }
  const notion = new Client({ auth: apiKey });
  listChildren = async (blockId) => {
    const all = [];
    let cursor;
    do {
      const res = await notion.blocks.children.list({
        block_id: blockId,
        page_size: 100,
        start_cursor: cursor,
      });
      all.push(...res.results);
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);
    return all;
  };
  console.log("[build-kb] source: Notion API");
}

// ---------- block helpers ----------

function richTextToPlain(rt = []) {
  return rt.map((t) => t.plain_text ?? "").join("");
}

function richTextToMarkdown(rt = []) {
  return rt
    .map((t) => {
      let s = t.plain_text ?? "";
      const a = t.annotations ?? {};
      if (a.code) s = `\`${s}\``;
      if (a.bold) s = `**${s}**`;
      if (a.italic) s = `*${s}*`;
      if (t.href) s = `[${s}](${t.href})`;
      return s;
    })
    .join("");
}

/** Render a single Notion block (and its children) to a markdown string. */
async function blockToMarkdown(block, depth = 0) {
  const t = block.type;
  const indent = "  ".repeat(depth);
  let out = "";
  switch (t) {
    case "paragraph":
      out = richTextToMarkdown(block.paragraph.rich_text);
      break;
    case "heading_1":
      out = `# ${richTextToMarkdown(block.heading_1.rich_text)}`;
      break;
    case "heading_2":
      out = `## ${richTextToMarkdown(block.heading_2.rich_text)}`;
      break;
    case "heading_3":
      out = `### ${richTextToMarkdown(block.heading_3.rich_text)}`;
      break;
    case "bulleted_list_item":
      out = `${indent}- ${richTextToMarkdown(block.bulleted_list_item.rich_text)}`;
      break;
    case "numbered_list_item":
      out = `${indent}1. ${richTextToMarkdown(block.numbered_list_item.rich_text)}`;
      break;
    case "quote":
      out = `> ${richTextToMarkdown(block.quote.rich_text)}`;
      break;
    case "code":
      out =
        "```" +
        (block.code.language ?? "") +
        "\n" +
        richTextToPlain(block.code.rich_text) +
        "\n```";
      break;
    case "divider":
      out = "---";
      break;
    case "toggle":
      out = richTextToMarkdown(block.toggle.rich_text);
      break;
    case "callout":
      out = `> ${richTextToMarkdown(block.callout.rich_text)}`;
      break;
    case "table": {
      const rows = block.has_children ? await listChildren(block.id) : [];
      const lines = [];
      let headerEmitted = false;
      for (const row of rows) {
        if (row.type !== "table_row") continue;
        const cells = row.table_row.cells.map((c) => richTextToMarkdown(c));
        lines.push(`| ${cells.join(" | ")} |`);
        if (!headerEmitted && block.table?.has_column_header) {
          lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
          headerEmitted = true;
        }
      }
      out = lines.join("\n");
      break;
    }
    case "table_row":
    case "child_page":
      out = "";
      break;
    default:
      out = "";
  }
  if (block.has_children && t !== "child_page" && t !== "table") {
    const kids = await listChildren(block.id);
    const childMd = (await Promise.all(kids.map((k) => blockToMarkdown(k, depth + 1)))).join("\n");
    if (childMd.trim()) out += (out ? "\n" : "") + childMd;
  }
  return out;
}

async function blocksToMarkdown(blocks) {
  const parts = await Promise.all(blocks.map((b) => blockToMarkdown(b)));
  return parts.join("\n").trim();
}

// ---------- layer discovery ----------

/**
 * A Layer is opened by a heading_1 block whose text matches
 *   /^Layer\s+\d+(?:\.\d+)?\s*[—–-]\s*(.+)$/
 * A Layer's contentBlocks run until the NEXT heading_1 — Layer or not.
 * Non-Layer heading_1s (Logging Structure, Glossary, Summary Principle)
 * close the current layer but are not extracted themselves.
 */
async function discoverLayers() {
  const topLevel = await listChildren(KB_PAGE_ID);
  const layers = [];
  let current = null;
  for (const b of topLevel) {
    if (b.type === "heading_1") {
      // any H1 closes the current layer
      if (current) {
        layers.push(current);
        current = null;
      }
      const text = richTextToPlain(b.heading_1.rich_text);
      const m = text.match(/^Layer\s+(\d+(?:\.\d+)?)\s*[—–-]\s*(.+)$/);
      if (m) {
        current = {
          layerNumber: m[1],
          title: m[2].trim(),
          headingBlockId: b.id,
          contentBlocks: [],
        };
      }
      continue;
    }
    if (current) current.contentBlocks.push(b);
  }
  if (current) layers.push(current);
  return layers;
}

// ---------- section helpers ----------

function headingText(b) {
  if (b.type === "heading_1") return richTextToPlain(b.heading_1.rich_text);
  if (b.type === "heading_2") return richTextToPlain(b.heading_2.rich_text);
  if (b.type === "heading_3") return richTextToPlain(b.heading_3.rich_text);
  return "";
}

/**
 * Walk a layer's contentBlocks and group into H2 sections.
 * Returns: [{ heading, level: 2, headingBlock: block|null, blocks: [...], h3Groups: [...] }]
 * h3Groups: [{ heading, level: 3, headingBlock, blocks }]
 * Pre-amble (content before first heading_2) becomes a synthetic "Intro" section.
 */
async function groupSections(contentBlocks) {
  const sections = [];
  let sec = null; // current H2 section
  let h3 = null; // current H3 group

  const ensureSection = () => {
    if (!sec) {
      sec = { heading: "Intro", level: 2, headingBlock: null, blocks: [], h3Groups: [] };
    }
  };

  for (const b of contentBlocks) {
    if (b.type === "heading_2") {
      if (sec) sections.push(sec);
      h3 = null;
      sec = {
        heading: headingText(b),
        level: 2,
        headingBlock: b,
        blocks: [],
        h3Groups: [],
      };
      continue;
    }
    if (b.type === "heading_3") {
      ensureSection();
      h3 = {
        heading: headingText(b),
        level: 3,
        headingBlock: b,
        blocks: [],
      };
      sec.h3Groups.push(h3);
      continue;
    }
    ensureSection();
    if (h3) h3.blocks.push(b);
    else sec.blocks.push(b);
  }
  if (sec) sections.push(sec);
  return sections;
}

// ---------- per-layer extractors ----------

// Shape A: prose-only layers (L2, L2.5, L6, L7) and L1's "sections" view.
const SimpleSectionsSchema = z
  .array(
    z.object({
      heading: z.string().min(1),
      level: z.number().int().min(2).max(3),
      content_markdown: z.string().min(1),
    })
  )
  .min(1);

// Shape B: structured layers with H3-keyed entries (L1, L4, L5, L8).
const StructuredEntrySchema = z.object({
  // record key extracted from heading where applicable; null when n/a
  key: z.string().nullable(),
  heading: z.string().min(1),
  content_markdown: z.string().min(1),
});

const StructuredSectionsSchema = z
  .array(
    z.object({
      heading: z.string().min(1),
      level: z.literal(2),
      content_markdown: z.string(), // may be empty when section is pure H3 listing
      entries: z.array(StructuredEntrySchema),
    })
  )
  .min(1);

function makeMeta(layerNumber, title) {
  return {
    layer: Number.isInteger(Number(layerNumber)) ? Number(layerNumber) : layerNumber,
    title,
    source_page_id: KB_PAGE_ID,
  };
}

async function buildSimpleSections(layer) {
  const sections = await groupSections(layer.contentBlocks);
  const out = [];
  for (const s of sections) {
    // Render H2 prose followed by each H3 group inline
    const parts = [];
    const pre = await blocksToMarkdown(s.blocks);
    if (pre) parts.push(pre);
    for (const g of s.h3Groups) {
      const gpre = await blocksToMarkdown(g.blocks);
      parts.push(`### ${g.heading}` + (gpre ? `\n${gpre}` : ""));
    }
    const md = parts.join("\n").trim();
    if (md) out.push({ heading: s.heading, level: 2, content_markdown: md });
  }
  return out;
}

async function buildStructuredSections(layer, keyParser) {
  const sections = await groupSections(layer.contentBlocks);
  const out = [];
  for (const s of sections) {
    const intro = (await blocksToMarkdown(s.blocks)).trim();
    const entries = [];
    for (const g of s.h3Groups) {
      const md = (await blocksToMarkdown(g.blocks)).trim();
      const key = keyParser ? keyParser(g.heading) : null;
      entries.push({ key, heading: g.heading, content_markdown: md });
    }
    out.push({
      heading: s.heading,
      level: 2,
      content_markdown: intro,
      entries,
    });
  }
  return out;
}

// ---------- Layer 1 ----------
const Layer1Schema = z.object({
  layer: z.literal(1),
  title: z.string().min(1),
  source_page_id: z.string().min(1),
  content_hash: z.string().length(64),
  sections: StructuredSectionsSchema,
});
async function extractLayer1(layer) {
  const sections = await buildStructuredSections(layer, () => null);
  return { ...makeMeta(1, layer.title), sections };
}

// ---------- Layer 2 ----------
const Layer2Schema = z.object({
  layer: z.literal(2),
  title: z.string().min(1),
  source_page_id: z.string().min(1),
  content_hash: z.string().length(64),
  sections: SimpleSectionsSchema,
});
async function extractLayer2(layer) {
  const sections = await buildSimpleSections(layer);
  return { ...makeMeta(2, layer.title), sections };
}

// ---------- Layer 2.5 ----------
const Layer2_5Schema = z.object({
  layer: z.literal("2.5"),
  title: z.string().min(1),
  source_page_id: z.string().min(1),
  content_hash: z.string().length(64),
  sections: SimpleSectionsSchema,
});
async function extractLayer2_5(layer) {
  const sections = await buildSimpleSections(layer);
  return { ...makeMeta("2.5", layer.title), sections };
}

// ---------- Layer 3 ----------
// Doctrine the engine reasons over → structured rules table + bookend prose.
const Layer3Schema = z.object({
  layer: z.literal(3),
  title: z.string().min(1),
  source_page_id: z.string().min(1),
  content_hash: z.string().length(64),
  intro_markdown: z.string(),
  rules: z
    .array(
      z.object({
        indicator: z.string().min(1),
        condition: z.string().min(1),
        action: z.string().min(1),
      })
    )
    .min(1),
  trailing_markdown: z.string(),
});
async function extractLayer3(layer) {
  // Find the single table block; collect prose before / after it.
  const before = [];
  const after = [];
  let tableBlock = null;
  for (const b of layer.contentBlocks) {
    if (b.type === "table" && !tableBlock) {
      tableBlock = b;
      continue;
    }
    (tableBlock ? after : before).push(b);
  }
  if (!tableBlock) {
    throw new Error("Layer 3 has no table block");
  }
  const rows = tableBlock.has_children ? await listChildren(tableBlock.id) : [];
  const rules = [];
  let isFirstRow = true;
  for (const row of rows) {
    if (row.type !== "table_row") continue;
    const cells = row.table_row.cells.map((c) => richTextToMarkdown(c).trim());
    if (isFirstRow && tableBlock.table?.has_column_header) {
      isFirstRow = false;
      continue;
    }
    isFirstRow = false;
    if (cells.length < 3) continue;
    rules.push({
      indicator: cells[0],
      condition: cells[1],
      action: cells[2],
    });
  }
  const intro_markdown = await blocksToMarkdown(before);
  const trailing_markdown = await blocksToMarkdown(after);
  return {
    ...makeMeta(3, layer.title),
    intro_markdown,
    rules,
    trailing_markdown,
  };
}

// ---------- Layer 4 ----------
// Goals library. Structured: H2 cluster sections (A · …, B · …, …), each with
// H3 entries keyed by goal-code (A1, B2, etc). The L4 H1 cleanly contains
// A1–F6 today; F7 + G* are corrupted under Layer 8 and are NOT extracted here
// (and the Layer 8 guard rejects them on its side too).
const Layer4Schema = z.object({
  layer: z.literal(4),
  title: z.string().min(1),
  source_page_id: z.string().min(1),
  content_hash: z.string().length(64),
  sections: StructuredSectionsSchema,
});
const GOAL_CODE_RE = /^([A-G]\d+)\b/;
async function extractLayer4(layer) {
  const parseCode = (h) => {
    const m = h.match(GOAL_CODE_RE);
    return m ? m[1] : null;
  };
  const sections = await buildStructuredSections(layer, parseCode);
  // Sanity: no F7 or G* under L4 today; if any sneak in, flag.
  const stray = [];
  for (const s of sections) {
    for (const e of s.entries) {
      if (e.key && /^([G]\d+|F[7-9]\d?)$/.test(e.key)) stray.push(e.key);
    }
  }
  if (stray.length > 0) {
    throw new Error(
      `Layer 4 contains corrupted entries that belong post-cleanup: ${stray.join(
        ", "
      )} — leave them under Layer 8 until KB Editor re-authors them.`
    );
  }
  return { ...makeMeta(4, layer.title), sections };
}

// ---------- Layer 5 ----------
const Layer5Schema = z.object({
  layer: z.literal(5),
  title: z.string().min(1),
  source_page_id: z.string().min(1),
  content_hash: z.string().length(64),
  sections: StructuredSectionsSchema,
});
async function extractLayer5(layer) {
  const parseCode = (h) => {
    const m = h.match(GOAL_CODE_RE);
    return m ? m[1] : null;
  };
  const sections = await buildStructuredSections(layer, parseCode);
  return { ...makeMeta(5, layer.title), sections };
}

// ---------- Layer 6 ----------
// Communication protocol. H2 sections each carry meaningful H3 entries (the
// six foundation tone principles, scripted copy groups, comeback undertones).
// Shape switched from PR1's flat H2+H3-as-siblings to the structured shape
// shared with L1/L4/L5/L8 — 12.3 engine wires L6 fresh against this shape.
const Layer6Schema = z.object({
  layer: z.literal(6),
  title: z.string().min(1),
  source_page_id: z.string().min(1),
  content_hash: z.string().length(64),
  sections: StructuredSectionsSchema,
});
async function extractLayer6(layer) {
  const sections = await buildStructuredSections(layer, () => null);
  return { ...makeMeta(6, layer.title), sections };
}

// ---------- Layer 7 ----------
const Layer7Schema = z.object({
  layer: z.literal(7),
  title: z.string().min(1),
  source_page_id: z.string().min(1),
  content_hash: z.string().length(64),
  sections: SimpleSectionsSchema,
});
async function extractLayer7(layer) {
  const sections = await buildSimpleSections(layer);
  return { ...makeMeta(7, layer.title), sections };
}

// ---------- Layer 8 ----------
// Exercise library. Structured: H2 cluster sections, each with H3 exercise
// entries keyed by number (1, 2, …). Guard: any H3 matching ^[A-G]\d is the
// known boundary corruption (F7 + G1–G5 stranded here) and fails the build.
const EXERCISE_NUMBER_RE = /^(\d+)\.\s+/;
const STRANDED_GOAL_RE = /^([A-G]\d+)\b/;
// Known-misplaced goal-code H3 entries that physically live under Layer 8 in
// the current Kennisbank but logically belong to Layer 4. KB Editor will
// re-author them post-alpha; Layer 4 re-extracts then. Until then this set is
// skipped (not extracted into either layer). Anything matching the
// STRANDED_GOAL_RE that ISN'T in this set is drift and fails the build.
const KNOWN_STRANDED_L8_CODES = new Set(["F7", "G1", "G2", "G3", "G4", "G5"]);
const Layer8Schema = z.object({
  layer: z.literal(8),
  title: z.string().min(1),
  source_page_id: z.string().min(1),
  content_hash: z.string().length(64),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1),
        level: z.literal(2),
        content_markdown: z.string(),
        entries: z.array(
          z.object({
            key: z.string().regex(/^\d+$/),
            heading: z.string().min(1),
            content_markdown: z.string().min(1),
          })
        ),
      })
    )
    .min(1),
});
async function extractLayer8(layer) {
  const sections = await groupSections(layer.contentBlocks);
  const skippedKnown = [];
  const driftHeadings = [];
  const out = [];
  for (const s of sections) {
    const intro = (await blocksToMarkdown(s.blocks)).trim();
    const entries = [];
    for (const g of s.h3Groups) {
      const strandedMatch = g.heading.match(STRANDED_GOAL_RE);
      if (strandedMatch) {
        const code = strandedMatch[1];
        if (KNOWN_STRANDED_L8_CODES.has(code)) {
          skippedKnown.push(g.heading);
          continue;
        }
        driftHeadings.push(g.heading);
        continue;
      }
      const m = g.heading.match(EXERCISE_NUMBER_RE);
      if (!m) {
        throw new Error(
          `Layer 8: H3 "${g.heading}" does not match exercise number pattern (^\\d+\\.)`
        );
      }
      const md = (await blocksToMarkdown(g.blocks)).trim();
      entries.push({ key: m[1], heading: g.heading, content_markdown: md });
    }
    // Drop sections that exist only because of known-stranded H2 wrappers
    // (e.g. "G · Aesthetic & Body-shape Focus") with no real exercise entries.
    if (entries.length === 0 && intro === "") continue;
    out.push({ heading: s.heading, level: 2, content_markdown: intro, entries });
  }
  if (skippedKnown.length > 0) {
    console.log(
      `[build-kb] Layer 8: skipped ${skippedKnown.length} known-misplaced entries ` +
        `(${skippedKnown.map((h) => h.match(STRANDED_GOAL_RE)[1]).join(", ")}) ` +
        `— logically Layer 4, awaiting KB Editor cleanup.`
    );
  }
  if (driftHeadings.length > 0) {
    throw new Error(
      `Layer 8: unexpected stranded goal-code H3 entries: ${driftHeadings.join(", ")}. ` +
        `Either add to KNOWN_STRANDED_L8_CODES (with sign-off) or fix the Kennisbank.`
    );
  }
  return { ...makeMeta(8, layer.title), sections: out };
}

// ---------- main ----------

const EXTRACTORS = {
  "1": { extractor: extractLayer1, schema: Layer1Schema, file: "layer-1.json" },
  "2": { extractor: extractLayer2, schema: Layer2Schema, file: "layer-2.json" },
  "2.5": { extractor: extractLayer2_5, schema: Layer2_5Schema, file: "layer-2.5.json" },
  "3": { extractor: extractLayer3, schema: Layer3Schema, file: "layer-3.json" },
  "4": { extractor: extractLayer4, schema: Layer4Schema, file: "layer-4.json" },
  "5": { extractor: extractLayer5, schema: Layer5Schema, file: "layer-5.json" },
  "6": { extractor: extractLayer6, schema: Layer6Schema, file: "layer-6.json" },
  "7": { extractor: extractLayer7, schema: Layer7Schema, file: "layer-7.json" },
  "8": { extractor: extractLayer8, schema: Layer8Schema, file: "layer-8.json" },
};

function withContentHash(data) {
  // Hash the JSON without content_hash itself, then re-emit with the hash
  // inserted right after source_page_id for stable, diff-friendly key order.
  const { layer, title, source_page_id, ...rest } = data;
  const forHash = { layer, title, source_page_id, ...rest };
  const hash = createHash("sha256").update(JSON.stringify(forHash)).digest("hex");
  return { layer, title, source_page_id, content_hash: hash, ...rest };
}

async function main() {
  console.log("[build-kb] discovering layers…");
  const layers = await discoverLayers();
  const found = layers.map((l) => l.layerNumber).join(", ");
  console.log(`[build-kb] found layers: ${found}`);

  await mkdir(KB_OUT_DIR, { recursive: true });

  const todo = Object.keys(EXTRACTORS);
  let failures = 0;
  for (const num of todo) {
    const layer = layers.find((l) => l.layerNumber === num);
    if (!layer) {
      console.error(`[build-kb] FAIL layer ${num}: not found in Kennisbank page`);
      failures++;
      continue;
    }
    const { extractor, schema, file } = EXTRACTORS[num];
    try {
      const raw = await extractor(layer);
      const hashed = withContentHash(raw);
      const parsed = schema.safeParse(hashed);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        console.error(
          `[build-kb] FAIL layer ${num} schema: path=${issue.path.join(".")} msg=${issue.message}`
        );
        failures++;
        continue;
      }
      const outPath = join(KB_OUT_DIR, file);
      await writeFile(outPath, JSON.stringify(parsed.data, null, 2) + "\n", "utf8");
      const summary = summariseLayer(num, parsed.data);
      console.log(`[build-kb] OK layer ${num} → ${file} (${summary})`);
    } catch (err) {
      console.error(`[build-kb] FAIL layer ${num} extract: ${err.message}`);
      failures++;
    }
  }

  if (failures > 0) {
    console.error(`[build-kb] ${failures} failure(s); exiting non-zero`);
    process.exit(1);
  }
  console.log("[build-kb] done");
}

function summariseLayer(num, data) {
  if (data.sections) {
    const total = data.sections.length;
    const entries = data.sections.reduce((a, s) => a + (s.entries?.length ?? 0), 0);
    return entries ? `${total} sections, ${entries} entries` : `${total} sections`;
  }
  if (data.rules) return `${data.rules.length} rules`;
  return "ok";
}

main().catch((err) => {
  console.error("[build-kb] FATAL:", err);
  process.exit(1);
});
