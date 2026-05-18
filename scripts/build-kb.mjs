#!/usr/bin/env node
/**
 * KB → JSON build-time pipeline (12.1, Tier A).
 * Reads Kennisbank from Notion, validates per-layer schemas, writes data/kb/layer-{N}.json.
 * Runs in `vercel-build` hook. Fails non-zero on any schema violation.
 */
import { Client } from "@notionhq/client";
import { z } from "zod";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const KB_OUT_DIR = join(REPO_ROOT, "data", "kb");

// Kennisbank root page in Notion (not a secret).
const KB_PAGE_ID = "3584fef0d1ea8130a745f81cac3a895a";

const apiKey = process.env.NOTION_BUILD_API_KEY;
if (!apiKey) {
  console.error("[build-kb] FATAL: NOTION_BUILD_API_KEY not set");
  process.exit(1);
}
const notion = new Client({ auth: apiKey });

// ---------- block helpers ----------

async function listChildren(blockId) {
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
}

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
      out = "```" + (block.code.language ?? "") + "\n" + richTextToPlain(block.code.rich_text) + "\n```";
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
    case "child_page":
    case "table":
    case "table_row":
      out = ""; // tables handled by parent; child_page skipped at layer level
      break;
    default:
      out = "";
  }
  if (block.has_children && t !== "child_page") {
    const kids = await listChildren(block.id);
    const childMd = (await Promise.all(kids.map((k) => blockToMarkdown(k, depth + 1)))).join("\n");
    if (childMd.trim()) out += (out ? "\n" : "") + childMd;
  }
  return out;
}

// ---------- layer discovery ----------

/**
 * Layer is a heading_1 block whose text matches /^Layer\s+\d+(\.\d+)?\s*—/.
 * Returns array of { layerNumber, title, headingBlockId, contentBlocks: [block...] }
 * where contentBlocks are sibling blocks between this layer heading and the next.
 */
async function discoverLayers() {
  const topLevel = await listChildren(KB_PAGE_ID);
  const layers = [];
  let current = null;
  for (const b of topLevel) {
    if (b.type === "heading_1") {
      const text = richTextToPlain(b.heading_1.rich_text);
      const m = text.match(/^Layer\s+(\d+(?:\.\d+)?)\s*[—–-]\s*(.+)$/);
      if (m) {
        if (current) layers.push(current);
        current = {
          layerNumber: m[1],
          title: m[2].trim(),
          headingBlockId: b.id,
          contentBlocks: [],
        };
        continue;
      }
    }
    if (current) current.contentBlocks.push(b);
  }
  if (current) layers.push(current);
  return layers;
}

// ---------- layer schemas ----------

const sectionSchema = z.object({
  heading: z.string(),
  level: z.number().int().min(1).max(6),
  content_markdown: z.string(),
});

const makeLayerSchema = (layerLiteral) =>
  z.object({
    layer: z.literal(layerLiteral),
    title: z.string(),
    source_page_id: z.string(),
    content_hash: z.string().regex(/^[a-f0-9]{64}$/),
    sections: z.array(sectionSchema),
  });

const layer1Schema = makeLayerSchema("1");
const layer2Schema = makeLayerSchema("2");
const layer25Schema = makeLayerSchema("2.5");
const layer3Schema = makeLayerSchema("3");
const layer6Schema = makeLayerSchema("6");

// ---------- shared section extractor ----------

async function extractSectionsLayer(layer) {
  // Group content blocks into sections by heading_2 / heading_3 boundaries.
  const sections = [];
  let cur = null;
  for (const b of layer.contentBlocks) {
    if (b.type === "heading_2" || b.type === "heading_3") {
      if (cur) sections.push(cur);
      const headingText = richTextToPlain(
        b.type === "heading_2" ? b.heading_2.rich_text : b.heading_3.rich_text
      );
      cur = {
        heading: headingText,
        level: b.type === "heading_2" ? 2 : 3,
        _blocks: [],
      };
      // include the heading's own children if any
      if (b.has_children) {
        const kids = await listChildren(b.id);
        cur._blocks.push(...kids);
      }
      continue;
    }
    if (!cur) {
      // pre-amble content before first heading_2 → synthetic intro section
      cur = { heading: "Intro", level: 2, _blocks: [] };
    }
    cur._blocks.push(b);
  }
  if (cur) sections.push(cur);

  const out = [];
  for (const s of sections) {
    const md = (await Promise.all(s._blocks.map((b) => blockToMarkdown(b)))).join("\n").trim();
    if (md) {
      out.push({ heading: s.heading, level: s.level, content_markdown: md });
    }
  }

  const hashable = {
    layer: layer.layerNumber,
    title: layer.title,
    source_page_id: KB_PAGE_ID,
    sections: out,
  };
  const content_hash = createHash("sha256").update(JSON.stringify(hashable)).digest("hex");
  return {
    layer: layer.layerNumber,
    title: layer.title,
    source_page_id: KB_PAGE_ID,
    content_hash,
    sections: out,
  };
}

// ---------- main ----------

const EXTRACTORS = {
  "1": { schema: layer1Schema, extract: extractSectionsLayer },
  "2": { schema: layer2Schema, extract: extractSectionsLayer },
  "2.5": { schema: layer25Schema, extract: extractSectionsLayer },
  "3": { schema: layer3Schema, extract: extractSectionsLayer },
  "6": { schema: layer6Schema, extract: extractSectionsLayer },
};

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
    const { extract, schema } = EXTRACTORS[num];
    const file = `layer-${num}.json`;
    try {
      const data = await extract(layer);
      const parsed = schema.safeParse(data);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        console.error(`[build-kb] FAIL layer ${num} schema: path=${issue.path.join(".")} msg=${issue.message}`);
        failures++;
        continue;
      }
      const outPath = join(KB_OUT_DIR, file);
      await writeFile(outPath, JSON.stringify(parsed.data, null, 2) + "\n", "utf8");
      console.log(`[build-kb] OK layer ${num} → ${file} (${parsed.data.sections.length} sections)`);
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

main().catch((err) => {
  console.error("[build-kb] FATAL:", err);
  process.exit(1);
});
