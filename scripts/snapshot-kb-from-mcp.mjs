#!/usr/bin/env node
/**
 * Dev helper: turn Notion MCP "enhanced Markdown" page fetch output into a
 * snapshot file consumable by scripts/build-kb.mjs via KB_SNAPSHOT_FILE.
 *
 * Purpose: in cloud sessions without NOTION_BUILD_API_KEY (the build-side key,
 * never available at runtime), we still need to regenerate data/kb/*.json so
 * the commit reflects current Notion state. The same extractors run against
 * the snapshot as run against the live API in Vercel; only the block fetch
 * differs. The first Vercel build is the cross-path equivalence test —
 * deterministic content_hash makes drift trivially visible.
 *
 * Usage:
 *   node scripts/snapshot-kb-from-mcp.mjs <input.md> <output.json>
 *
 * The input must be the markdown body extracted from the MCP fetch result's
 * <content>…</content> section (with no surrounding JSON envelope). Run is
 * idempotent: same input → byte-identical snapshot.
 */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const KB_PAGE_ID = "3584fef0d1ea8130a745f81cac3a895a";

function usage() {
  console.error("usage: snapshot-kb-from-mcp.mjs <input.md> <output.json>");
  process.exit(2);
}

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) usage();

const md = await readFile(inputPath, "utf8");

// ---------- markdown unescape ----------
// Notion MCP markdown output escapes a set of ASCII punctuation with a
// leading backslash so that the markdown round-trip is unambiguous. The live
// Notion API's rich_text plain_text does NOT contain those escapes, so we
// remove them to converge the two paths' output bytes.
const ESCAPED_CHARS = new Set([
  "\\",
  "`",
  "*",
  "_",
  "{",
  "}",
  "[",
  "]",
  "(",
  ")",
  "#",
  "+",
  "-",
  ".",
  "!",
  "|",
  "<",
  ">",
  "~",
  "=",
]);
function unescapeInline(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && i + 1 < s.length && ESCAPED_CHARS.has(s[i + 1])) {
      out += s[i + 1];
      i++;
    } else {
      out += s[i];
    }
  }
  return out;
}

// ---------- synthetic block id ----------
function makeId(kind, ix) {
  const h = createHash("sha1").update(`${kind}:${ix}`).digest("hex");
  // shape it like a notion uuid
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

// ---------- inline rich_text builder ----------
// One rich_text span per block, no annotations. blockToMarkdown's
// richTextToMarkdown returns plain_text verbatim when annotations is empty,
// so the original markdown line is preserved end-to-end.
function rt(s) {
  return [{ plain_text: unescapeInline(s), annotations: {}, type: "text" }];
}

// ---------- parser ----------
const lines = md.split("\n");
const topLevel = [];
const childMap = {};
let counter = 0;
const nextId = (kind) => makeId(kind, counter++);

let i = 0;
while (i < lines.length) {
  const raw = lines[i];
  const line = raw;
  // table block
  if (line.trim().startsWith("<table")) {
    const headerRow = /header-row="true"/.test(line);
    const tableId = nextId("table");
    const rows = [];
    i++;
    while (i < lines.length && !lines[i].trim().startsWith("</table>")) {
      if (lines[i].trim().startsWith("<tr>")) {
        i++;
        const cells = [];
        while (i < lines.length && !lines[i].trim().startsWith("</tr>")) {
          const tdLine = lines[i].trim();
          const m = tdLine.match(/^<td>(.*)<\/td>\s*$/);
          if (m) {
            cells.push(rt(m[1]));
          } else if (tdLine.startsWith("<td>")) {
            // multi-line cell: accumulate until </td>
            let cellAcc = tdLine.slice(4);
            i++;
            while (i < lines.length && !lines[i].includes("</td>")) {
              cellAcc += "\n" + lines[i];
              i++;
            }
            if (i < lines.length) {
              cellAcc += "\n" + lines[i].split("</td>")[0];
            }
            cells.push(rt(cellAcc));
          }
          i++;
        }
        const rowId = nextId("table_row");
        rows.push({
          object: "block",
          id: rowId,
          type: "table_row",
          has_children: false,
          table_row: { cells },
        });
        // i now points at </tr>
      }
      i++;
    }
    // i now points at </table>
    const tableBlock = {
      object: "block",
      id: tableId,
      type: "table",
      has_children: rows.length > 0,
      table: {
        has_column_header: headerRow,
        has_row_header: false,
        table_width: rows[0]?.table_row?.cells?.length ?? 0,
      },
    };
    childMap[tableId] = rows;
    topLevel.push(tableBlock);
    i++;
    continue;
  }
  // heading_1
  let m;
  if ((m = line.match(/^# (.+)$/))) {
    topLevel.push({
      object: "block",
      id: nextId("h1"),
      type: "heading_1",
      has_children: false,
      heading_1: { rich_text: rt(m[1]), color: "default", is_toggleable: false },
    });
    i++;
    continue;
  }
  if ((m = line.match(/^## (.+)$/))) {
    topLevel.push({
      object: "block",
      id: nextId("h2"),
      type: "heading_2",
      has_children: false,
      heading_2: { rich_text: rt(m[1]), color: "default", is_toggleable: false },
    });
    i++;
    continue;
  }
  if ((m = line.match(/^### (.+)$/))) {
    topLevel.push({
      object: "block",
      id: nextId("h3"),
      type: "heading_3",
      has_children: false,
      heading_3: { rich_text: rt(m[1]), color: "default", is_toggleable: false },
    });
    i++;
    continue;
  }
  if (line.match(/^---\s*$/)) {
    topLevel.push({
      object: "block",
      id: nextId("divider"),
      type: "divider",
      has_children: false,
      divider: {},
    });
    i++;
    continue;
  }
  if ((m = line.match(/^- (.*)$/))) {
    topLevel.push({
      object: "block",
      id: nextId("bul"),
      type: "bulleted_list_item",
      has_children: false,
      bulleted_list_item: { rich_text: rt(m[1]), color: "default" },
    });
    i++;
    continue;
  }
  if ((m = line.match(/^\d+\.\s+(.*)$/))) {
    topLevel.push({
      object: "block",
      id: nextId("num"),
      type: "numbered_list_item",
      has_children: false,
      numbered_list_item: { rich_text: rt(m[1]), color: "default" },
    });
    i++;
    continue;
  }
  if ((m = line.match(/^>\s?(.*)$/))) {
    topLevel.push({
      object: "block",
      id: nextId("quote"),
      type: "quote",
      has_children: false,
      quote: { rich_text: rt(m[1]), color: "default" },
    });
    i++;
    continue;
  }
  if (line.trim() === "") {
    // Drop empty lines — they're not Notion blocks.
    i++;
    continue;
  }
  // paragraph
  topLevel.push({
    object: "block",
    id: nextId("p"),
    type: "paragraph",
    has_children: false,
    paragraph: { rich_text: rt(line), color: "default" },
  });
  i++;
}

const snapshot = {
  source: "notion-mcp-markdown",
  page_id: KB_PAGE_ID,
  topLevel,
  childMap,
};
await writeFile(outputPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
console.log(
  `[snapshot] wrote ${outputPath} (${topLevel.length} top-level blocks, ${Object.keys(childMap).length} parent blocks with children)`
);
