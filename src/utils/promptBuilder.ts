/**
 * Deterministic prompt-building utilities.
 *
 * The final prompt is assembled from the project data directly so another AI
 * model does not rewrite, infer, or silently change the user's layout. The
 * builder emits multiple redundant representations of the same layout (prose,
 * an ASCII grid, four-corner coordinates, an adjacency matrix, and a JSON
 * block) so the downstream image generator has minimal room for drift.
 */

export interface PromptRoomItem {
  id: string;
  name: string;
  direction: number;
}

export type PromptWallAttachment = 'free' | 'attached';
export type PromptTableShape = 'rectangular' | 'round' | 'oval' | 'u-shape' | 'l-shape';

export interface PromptRoom {
  name: string;
  description: string;
  x: number | null;
  y: number | null;
  width: number;
  length: number;
  roomType: string;
  partitionType: string;
  furnitureStyle: string;
  features: string[];
  direction: number;
  items?: PromptRoomItem[];
  wallAttachment?: PromptWallAttachment;
  tableShape?: PromptTableShape;
}

interface NormalizedRoom {
  source: PromptRoom;
  index: number;
  label: string;
  displayName: string;
  category: string;
  partition: string;
  furniture: string;
  features: string[];
  items: { name: string; direction: string; degrees: number }[];
  width: number;
  length: number;
  area: number;
  xPercent: number;
  yPercent: number;
  centerXM: number;
  centerYM: number;
  leftXM: number;
  rightXM: number;
  topYM: number;
  bottomYM: number;
  directionDegrees: number;
  directionLabel: string;
  region: string;
  placementStatus: "placed" | "missing";
  explicitCountText: string | null;
  notesEnglish: string | null;
  wallAttachment: PromptWallAttachment;
  tableShape: PromptTableShape | null;
}

interface AdjacencyEntry {
  from: string;
  to: string;
  relation: string;
  gap_m: number;
}

interface WallSegment {
  between: [string, string];
  axis: "vertical" | "horizontal";
  position_m: number;
  span_from_m: number;
  span_to_m: number;
  shared_length_m: number;
  partition: string;
}

const DEFAULT_ROOM_SIZE_M = 4;
const ASCII_TARGET_WIDTH = 56;
const ASCII_MAX_HEIGHT = 32;
const ADJACENCY_TOUCH_TOLERANCE_M = 0.4;

const cardinalDirections: Record<number, string> = {
  0: "North",
  90: "East",
  180: "South",
  270: "West",
};

const arabicDigitMap: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

const arabicItemDictionary: Array<[RegExp, string]> = [
  [/مكتب|طاولة/i, "desk or table"],
  [/كرسي|كراسي/i, "chair"],
  [/شاشة/i, "display screen"],
  [/كنبة|صوفا|اريكة|أريكة/i, "sofa"],
  [/نبات/i, "indoor plant"],
  [/رف|ارفف|أرفف/i, "wall shelves"],
  [/خزانة|دولاب/i, "cabinet"],
  [/كاونتر|استقبال/i, "reception counter"],
  [/سبورة/i, "whiteboard"],
  [/قهوة|ماكينة/i, "coffee machine"],
];

function normalizeArabicDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (digit) => arabicDigitMap[digit] || digit);
}

function formatMeters(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function safeDimension(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_ROOM_SIZE_M;
  }
  return Math.round(value * 10) / 10;
}

function normalizeDirection(degrees: number | null | undefined): number {
  if (typeof degrees !== "number" || !Number.isFinite(degrees)) return 0;
  const normalized = ((degrees % 360) + 360) % 360;
  return Math.round(normalized);
}

function directionLabel(degrees: number): string {
  const exact = cardinalDirections[degrees];
  if (exact) return exact;
  return `${degrees} degrees clockwise from North`;
}

function extractEnglish(value: string | null | undefined, fallback = "Specified"): string {
  const source = (value || "").trim();
  if (!source) return fallback;

  const matches = [...source.matchAll(/\(([^()]*)\)/g)];
  if (matches.length > 0) {
    return matches[matches.length - 1][1].trim();
  }

  const ascii = source
    .replace(/[^\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /[A-Za-z0-9]/.test(ascii) ? ascii : fallback;
}

function translateKnownArabicItem(value: string): string | null {
  for (const [pattern, translation] of arabicItemDictionary) {
    if (pattern.test(value)) return translation;
  }
  return null;
}

function toEnglishSafe(value: string | null | undefined, fallback: string): string {
  const source = (value || "").trim();
  if (!source) return fallback;

  const extracted = extractEnglish(source, "");
  if (extracted) return extracted;

  const translated = translateKnownArabicItem(source);
  if (translated) return translated;

  const ascii = source
    .replace(/[^\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /[A-Za-z0-9]/.test(ascii) ? ascii : fallback;
}

function deriveRoomLabel(room: PromptRoom, index: number): string {
  const type = extractEnglish(room.roomType, "").toLowerCase();
  const number = index + 1;

  if (type.includes("large meeting")) return `GM${number}`;
  if (type.includes("small meeting")) return `MR-S${number}`;
  if (type.includes("meeting")) return `MR${number}`;
  if (type.includes("reception")) return `REC${number}`;
  if (type.includes("executive") || type.includes("private office")) return `PO${number}`;
  if (type.includes("open workspace") || type.includes("workstation")) return `WS${number}`;
  if (type.includes("coffee")) return `CF${number}`;
  if (type.includes("waiting")) return `WL${number}`;
  if (type.includes("server")) return `SR${number}`;
  if (type.includes("storage")) return `ST${number}`;
  if (type.includes("standalone glass")) return `GLS${number}`;
  if (type.includes("solid partition")) return `WALL${number}`;

  return `ZN${number}`;
}

function roomRegion(xPercent: number, yPercent: number): string {
  const vertical = yPercent < 33.34 ? "north" : yPercent > 66.66 ? "south" : "central";
  const horizontal = xPercent < 33.34 ? "west" : xPercent > 66.66 ? "east" : "central";
  if (vertical === "central" && horizontal === "central") return "central";
  return `${vertical}-${horizontal}`;
}

function extractExplicitCountText(description: string, features: string[]): string | null {
  const joined = normalizeArabicDigits(`${description || ""} ${features.join(" ")}`);
  const match = joined.match(/(\d+)\s*(chairs?|seats?|people|persons|occupants|كرسي|كراسي|اشخاص|أشخاص|مقاعد)/i);
  if (!match) return null;

  const count = Number(match[1]);
  if (!Number.isFinite(count) || count <= 0) return null;
  return `use exactly ${count} chairs/seats when seating is required`;
}

function extractAsciiNotes(description: string): string | null {
  const ascii = normalizeArabicDigits(description || "")
    .replace(/[^\x20-\x7E]+/g, " ")
    // Drop dangling colons / slashes / parentheses that are left over from
    // stripping Arabic glyphs out of mixed-language ZoneCard auto-descriptions.
    .replace(/(^|\s)[:/.,;()\\-]+(\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Require at least one English word that is 4+ letters long; otherwise the
  // "note" is just punctuation noise from auto-generated Arabic templates.
  if (!/[A-Za-z]{4,}/.test(ascii)) return null;
  if (ascii.length < 8) return null;
  return ascii;
}

function safeDisplayName(rawName: string | null | undefined, index: number): string {
  const fallback = `Zone ${index + 1}`;
  const extracted = extractEnglish(rawName, "");
  // Reject purely numeric "names" that lost their Arabic content.
  if (!extracted || /^[\d\s.\-_]+$/.test(extracted)) return fallback;
  return extracted;
}

function normalizeRoom(
  room: PromptRoom,
  index: number,
  workspaceWidth: number,
  workspaceLength: number,
): NormalizedRoom {
  const width = safeDimension(room.width);
  const length = safeDimension(room.length);
  const xPercent = clamp(room.x ?? 50, 0, 100);
  const yPercent = clamp(room.y ?? 50, 0, 100);
  const centerXM = Math.round((workspaceWidth * xPercent) / 10) / 10;
  const centerYM = Math.round((workspaceLength * yPercent) / 10) / 10;
  const directionDegrees = normalizeDirection(room.direction);

  return {
    source: room,
    index,
    label: deriveRoomLabel(room, index),
    displayName: safeDisplayName(room.name, index),
    category: extractEnglish(room.roomType, "General Zone"),
    partition: extractEnglish(room.partitionType, "Specified Partition"),
    furniture: extractEnglish(room.furnitureStyle, "Specified Furniture"),
    features: (room.features || []).map((feature) => extractEnglish(feature, feature)).filter(Boolean),
    items: (room.items || [])
      .filter((item) => item.name.trim().length > 0)
      .map((item, itemIndex) => {
        const degrees = normalizeDirection(item.direction);
        return {
          name: toEnglishSafe(item.name, `specified item ${itemIndex + 1}`),
          direction: directionLabel(degrees),
          degrees,
        };
      }),
    width,
    length,
    area: Math.round(width * length * 10) / 10,
    xPercent,
    yPercent,
    centerXM,
    centerYM,
    leftXM: Math.round((centerXM - width / 2) * 10) / 10,
    rightXM: Math.round((centerXM + width / 2) * 10) / 10,
    topYM: Math.round((centerYM - length / 2) * 10) / 10,
    bottomYM: Math.round((centerYM + length / 2) * 10) / 10,
    directionDegrees,
    directionLabel: directionLabel(directionDegrees),
    region: roomRegion(xPercent, yPercent),
    placementStatus: room.x === null || room.y === null ? "missing" : "placed",
    explicitCountText: extractExplicitCountText(room.description, room.features || []),
    notesEnglish: extractAsciiNotes(room.description),
    wallAttachment: room.wallAttachment === "attached" ? "attached" : "free",
    tableShape: room.tableShape ?? null,
  };
}

// Where the primary furniture sits inside the zone, given the user's chosen
// orientation for the room. When attached, the desk/counter is pushed against
// the wall on the side the room "faces"; when free, it sits centered.
function placementClause(room: NormalizedRoom): string {
  const dir = room.directionLabel.toLowerCase();
  const axisDescriptor = (() => {
    switch (room.directionDegrees) {
      case 0: return "long edge running east-west, the front of the desk facing south into the room";
      case 90: return "long edge running north-south, the front of the desk facing west into the room";
      case 180: return "long edge running east-west, the front of the desk facing north into the room";
      case 270: return "long edge running north-south, the front of the desk facing east into the room";
      default: return `front of the desk facing ${dir}`;
    }
  })();

  if (room.wallAttachment === "attached") {
    return `pushed flush against the ${dir}-side interior wall, ${axisDescriptor}`;
  }
  return `centered freely in the zone with clear circulation on all four sides, ${axisDescriptor}`;
}

// Default table shape per room type when the user hasn't picked one.
function resolveTableShape(room: NormalizedRoom): PromptTableShape | null {
  if (room.tableShape) return room.tableShape;
  const c = room.category.toLowerCase();
  if (c.includes("large meeting")) return "rectangular";
  if (c.includes("small meeting")) return "round";
  if (c.includes("meeting")) return "rectangular";
  if (c.includes("executive") || c.includes("private office")) return "l-shape";
  if (c.includes("reception")) return "rectangular";
  return null;
}

function describeShape(shape: PromptTableShape, fallback: string): string {
  switch (shape) {
    case "rectangular": return "rectangular";
    case "round": return "round / circular";
    case "oval": return "oval / racetrack-shaped";
    case "u-shape": return "U-shaped (open on one side)";
    case "l-shape": return "L-shaped";
    default: return fallback;
  }
}

function furnitureScale(room: NormalizedRoom): string {
  const category = room.category.toLowerCase();
  const shape = resolveTableShape(room);
  const placement = placementClause(room);

  if (category.includes("large meeting")) {
    const shapeWord = describeShape(shape || "rectangular", "rectangular");
    return `one solid wood ${shapeWord} conference table proportional to the room and ${placement}, surrounded by 8 black ergonomic mesh office chairs (3 along each long side, 1 at each short end if rectangular; 8 evenly spaced if round/oval), a single linear pendant ceiling light directly above the table, a wall-mounted flat-screen display on the short wall, a small whiteboard on an adjacent wall`;
  }

  if (category.includes("small meeting")) {
    const shapeWord = describeShape(shape || "round", "round");
    return `one ${shapeWord} wooden meeting table ${placement}, with 4 grey upholstered office chairs spaced evenly around it, a single ceiling pendant light above, a small whiteboard on the back wall`;
  }

  if (category.includes("meeting")) {
    const shapeWord = describeShape(shape || "rectangular", "rectangular");
    return `one ${shapeWord} wooden meeting table ${placement}, with 6 ergonomic chairs spaced evenly around it (3 each long side if rectangular), a pendant light above, a wall-mounted display on the back wall`;
  }

  if (category.includes("executive") || category.includes("private office")) {
    const shapeWord = describeShape(shape || "l-shape", "L-shaped");
    return `one premium ${shapeWord} wooden executive desk ${placement}, with a tall leather executive chair behind it, a single curved monitor on the desk, a desk lamp, 2 visitor chairs in front of the desk, a tall bookshelf on the side wall, a small indoor plant in the corner`;
  }

  if (category.includes("reception")) {
    const shapeWord = describeShape(shape || "rectangular", "curved");
    return `one ${shapeWord} wooden reception counter ${placement}, with a slim monitor on it, 2 lounge chairs and a small wooden coffee table in front of the counter facing visitors, a back-lit company logo sign on the wall behind the counter, a tall floor plant in one corner`;
  }

  if (category.includes("open workspace") || category.includes("workstation")) {
    if (room.width <= 1.6 && room.length <= 2) {
      return `one single white sit-stand desk ${placement}, with one ergonomic black mesh task chair tucked under it, one slim flat monitor on the desk, a keyboard and mouse, a small desk-organiser tray with a tiny succulent plant — render this as a fully furnished individual workstation, NOT an empty desk`;
    }
    return `multiple individual sit-stand desks arranged in tidy rows inside the zone (${placement.includes("attached") ? "rows aligned along the attached wall" : "centered cluster"}), each desk paired with one black mesh ergonomic chair, one slim flat monitor, keyboard and mouse — leave clear walking aisles between rows`;
  }

  if (category.includes("coffee")) {
    return `one wooden coffee bar counter ${placement}, with a chrome espresso machine on the counter, a row of mugs on shelves above, one small high round table with 2 stools nearby, a tall plant`;
  }

  if (category.includes("waiting")) {
    return `2 modern grey upholstered lounge sofas facing each other across a small wooden coffee table (the cluster ${room.wallAttachment === "attached" ? `pushed against the ${room.directionLabel.toLowerCase()} wall` : "centered freely in the zone"}), a magazine rack, a floor lamp, a tall potted plant`;
  }

  if (category.includes("server")) {
    return `server racks ${room.wallAttachment === "attached" ? `lined up against the ${room.directionLabel.toLowerCase()} wall` : "in two parallel rows in the center"}, with green/blue LED indicators, ceiling-mounted ventilation grilles, raised technical floor`;
  }

  if (category.includes("storage")) {
    return `floor-to-ceiling matte-white storage shelves ${room.wallAttachment === "attached" ? `on the ${room.directionLabel.toLowerCase()} wall only` : "on both side walls"}, with neatly stacked archival boxes`;
  }

  if (category.includes("standalone glass") || category.includes("glass partition")) {
    return `one tall transparent clear-glass partition wall with a slim black aluminium frame, oriented along the ${room.length > room.width ? "north-south" : "east-west"} axis, no furniture, no door`;
  }

  if (category.includes("solid partition")) {
    return `one solid drywall partition painted matte white, oriented along the ${room.length > room.width ? "north-south" : "east-west"} axis, no furniture, no door`;
  }

  return `furniture appropriate for a ${room.category}, fully populated and ${placement}, never empty`;
}

function partitionConstraint(room: NormalizedRoom): string {
  const partition = room.partition.toLowerCase();
  const category = room.category.toLowerCase();

  if (category.includes("glass partition")) {
    return "render as a standalone glass partition line with no furniture";
  }

  if (category.includes("solid partition")) {
    return "render as a standalone solid wall segment with no furniture";
  }

  if (partition.includes("open")) {
    return "completely open space with no walls and no glass partitions";
  }

  return `${room.partition} only as specified`;
}

function roomNarrative(room: NormalizedRoom): string {
  // Visual-only zone description: NO coordinates and NO numeric dimensions
  // here, both go to the hidden internal block. The model gets a sentence
  // about what to render, not a CAD callout to print on the floor.
  const orientationClause = `the room and its primary furniture face ${room.directionLabel} (${room.wallAttachment === "attached" ? "primary furniture pushed flush against the wall on that side" : "primary furniture sits centered freely in the zone"})`;
  const features = room.features.length > 0 ? ` Visible features: ${room.features.join(", ")}.` : "";
  const items =
    room.items.length > 0
      ? ` Required items inside the zone: ${room.items.map((item) => `${item.name} facing ${item.direction.toLowerCase()}`).join(", ")}.`
      : "";
  const count = room.explicitCountText ? ` Seating rule: ${room.explicitCountText}.` : "";
  const notes = room.notesEnglish ? ` Designer note: ${room.notesEnglish}.` : "";

  return `${room.label} (${room.region} area, ${room.category}; ${orientationClause}): ${partitionConstraint(room)}; ${room.furniture} material palette; ${furnitureScale(room)}.${features}${items}${count}${notes}`;
}

function buildAsciiDiagram(
  rooms: NormalizedRoom[],
  workspaceWidth: number,
  workspaceLength: number,
): string {
  if (workspaceWidth <= 0 || workspaceLength <= 0) return "(empty workspace)";
  const cols = ASCII_TARGET_WIDTH;
  const aspect = workspaceLength / workspaceWidth;
  // Terminal cells render ~2x taller than wide, halve the row count.
  const rows = clamp(Math.round((cols * aspect) / 2), 6, ASCII_MAX_HEIGHT);
  const cellW = workspaceWidth / cols;
  const cellH = workspaceLength / rows;

  const grid: string[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => "."),
  );

  const placed = rooms.filter((r) => r.placementStatus === "placed");
  placed.forEach((room) => {
    const c0 = clamp(Math.floor(room.leftXM / cellW), 0, cols - 1);
    const c1 = clamp(Math.ceil(room.rightXM / cellW) - 1, 0, cols - 1);
    const r0 = clamp(Math.floor(room.topYM / cellH), 0, rows - 1);
    const r1 = clamp(Math.ceil(room.bottomYM / cellH) - 1, 0, rows - 1);
    const fill = room.label[0] || "#";
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (r === r0 || r === r1 || c === c0 || c === c1) {
          grid[r][c] = "#";
        } else {
          grid[r][c] = fill;
        }
      }
    }
    // Drop the label at the center cell so the reader can map letters to rooms.
    const cr = clamp(Math.round((r0 + r1) / 2), 0, rows - 1);
    const cc = clamp(Math.round((c0 + c1) / 2), 0, cols - 1);
    const labelChars = room.label.split("");
    labelChars.forEach((ch, i) => {
      const tc = cc - Math.floor(labelChars.length / 2) + i;
      if (tc >= c0 + 1 && tc <= c1 - 1) {
        grid[cr][tc] = ch;
      }
    });
  });

  const top = `+${"-".repeat(cols)}+`;
  const body = grid.map((row) => `|${row.join("")}|`).join("\n");
  return `${top}\n${body}\n${top}`;
}

function buildAdjacencies(rooms: NormalizedRoom[]): AdjacencyEntry[] {
  const placed = rooms.filter((r) => r.placementStatus === "placed");
  const entries: AdjacencyEntry[] = [];

  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i];
      const b = placed[j];
      const xOverlap = Math.min(a.rightXM, b.rightXM) - Math.max(a.leftXM, b.leftXM);
      const yOverlap = Math.min(a.bottomYM, b.bottomYM) - Math.max(a.topYM, b.topYM);

      // Horizontal adjacency: overlapping Y ranges, near-touching X edges.
      if (yOverlap > 0) {
        const gap = Math.max(0, Math.max(a.leftXM, b.leftXM) - Math.min(a.rightXM, b.rightXM));
        if (gap <= ADJACENCY_TOUCH_TOLERANCE_M) {
          const aIsLeft = a.rightXM <= b.leftXM + ADJACENCY_TOUCH_TOLERANCE_M;
          entries.push({
            from: aIsLeft ? a.label : b.label,
            to: aIsLeft ? b.label : a.label,
            relation: gap < 0.05 ? "shares a vertical wall on the right of" : "is to the west of",
            gap_m: Math.round(gap * 10) / 10,
          });
        }
      }

      // Vertical adjacency: overlapping X ranges, near-touching Y edges.
      if (xOverlap > 0) {
        const gap = Math.max(0, Math.max(a.topYM, b.topYM) - Math.min(a.bottomYM, b.bottomYM));
        if (gap <= ADJACENCY_TOUCH_TOLERANCE_M) {
          const aIsTop = a.bottomYM <= b.topYM + ADJACENCY_TOUCH_TOLERANCE_M;
          entries.push({
            from: aIsTop ? a.label : b.label,
            to: aIsTop ? b.label : a.label,
            relation: gap < 0.05 ? "shares a horizontal wall on the south of" : "is to the north of",
            gap_m: Math.round(gap * 10) / 10,
          });
        }
      }
    }
  }

  return entries;
}

function buildWallSegments(rooms: NormalizedRoom[]): WallSegment[] {
  const placed = rooms.filter((r) => r.placementStatus === "placed");
  const segments: WallSegment[] = [];

  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i];
      const b = placed[j];

      // Vertical shared wall.
      if (Math.abs(a.rightXM - b.leftXM) < 0.05 || Math.abs(b.rightXM - a.leftXM) < 0.05) {
        const yStart = Math.max(a.topYM, b.topYM);
        const yEnd = Math.min(a.bottomYM, b.bottomYM);
        const shared = yEnd - yStart;
        if (shared > 0.1) {
          const xPos = Math.abs(a.rightXM - b.leftXM) < 0.05 ? a.rightXM : b.rightXM;
          segments.push({
            between: a.rightXM <= b.leftXM ? [a.label, b.label] : [b.label, a.label],
            axis: "vertical",
            position_m: Math.round(xPos * 10) / 10,
            span_from_m: Math.round(yStart * 10) / 10,
            span_to_m: Math.round(yEnd * 10) / 10,
            shared_length_m: Math.round(shared * 10) / 10,
            partition: a.partition === b.partition ? a.partition : `${a.partition} / ${b.partition}`,
          });
        }
      }

      // Horizontal shared wall.
      if (Math.abs(a.bottomYM - b.topYM) < 0.05 || Math.abs(b.bottomYM - a.topYM) < 0.05) {
        const xStart = Math.max(a.leftXM, b.leftXM);
        const xEnd = Math.min(a.rightXM, b.rightXM);
        const shared = xEnd - xStart;
        if (shared > 0.1) {
          const yPos = Math.abs(a.bottomYM - b.topYM) < 0.05 ? a.bottomYM : b.bottomYM;
          segments.push({
            between: a.bottomYM <= b.topYM ? [a.label, b.label] : [b.label, a.label],
            axis: "horizontal",
            position_m: Math.round(yPos * 10) / 10,
            span_from_m: Math.round(xStart * 10) / 10,
            span_to_m: Math.round(xEnd * 10) / 10,
            shared_length_m: Math.round(shared * 10) / 10,
            partition: a.partition === b.partition ? a.partition : `${a.partition} / ${b.partition}`,
          });
        }
      }
    }
  }

  return segments;
}

function buildDrawingCodes(
  rooms: NormalizedRoom[],
  workspaceWidth: number,
  workspaceLength: number,
  globalStyle: string,
  lighting: string,
  camera: string,
  layoutShape: string,
  engine: string,
  adjacencies: AdjacencyEntry[],
  walls: WallSegment[],
) {
  return {
    precision_mode: "deterministic_no_ai_rewrite",
    coordinate_system: {
      origin: "top-left",
      x_axis: "left-to-right",
      y_axis: "top-to-bottom",
      coordinates_are: "room center points",
      units: "meters",
    },
    workspace: {
      width_m: workspaceWidth,
      length_m: workspaceLength,
      area_sqm: Math.round(workspaceWidth * workspaceLength * 10) / 10,
      layout_shape: extractEnglish(layoutShape, layoutShape),
      global_style: extractEnglish(globalStyle, globalStyle),
      lighting: extractEnglish(lighting, lighting),
      camera: extractEnglish(camera, camera),
      target_engine: engine,
    },
    zones: rooms.map((room) => ({
      order: room.index + 1,
      id: room.label,
      original_name: room.source.name,
      english_name: room.displayName,
      category: room.category,
      placement_status: room.placementStatus,
      width_m: room.width,
      length_m: room.length,
      area_sqm: room.area,
      center_x_m: room.centerXM,
      center_y_m: room.centerYM,
      bbox_m: {
        left: room.leftXM,
        top: room.topYM,
        right: room.rightXM,
        bottom: room.bottomYM,
      },
      corners_m: {
        top_left: [room.leftXM, room.topYM],
        top_right: [room.rightXM, room.topYM],
        bottom_right: [room.rightXM, room.bottomYM],
        bottom_left: [room.leftXM, room.bottomYM],
      },
      x_percent: room.xPercent,
      y_percent: room.yPercent,
      orientation_degrees: room.directionDegrees,
      orientation_label: room.directionLabel,
      wall_attachment: room.wallAttachment,
      table_shape: room.tableShape,
      partition: room.partition,
      furniture_style: room.furniture,
      features: room.features,
      items: room.items,
      notes: room.source.description,
    })),
    adjacencies,
    shared_walls: walls,
  };
}

function buildAdjacencySummary(adjacencies: AdjacencyEntry[]): string {
  if (adjacencies.length === 0) {
    return "no two zones share a wall — every zone stands isolated with circulation around it";
  }
  return adjacencies
    .map(
      (entry) =>
        `${entry.from} ${entry.relation} ${entry.to}${
          entry.gap_m > 0 ? ` (gap ${formatMeters(entry.gap_m)}m)` : ""
        }`,
    )
    .join("; ");
}

function buildWallSummary(walls: WallSegment[]): string {
  if (walls.length === 0) {
    return "no shared walls between zones";
  }
  return walls
    .map(
      (wall) =>
        `${wall.axis === "vertical" ? "vertical" : "horizontal"} shared wall between ${wall.between[0]} and ${wall.between[1]} (${formatMeters(wall.shared_length_m)}m of ${wall.partition})`,
    )
    .join("; ");
}

export function getPromptBlockingIssues(
  rooms: PromptRoom[],
  workspaceWidth: number,
  workspaceLength: number,
): string[] {
  const issues: string[] = [];

  if (!Number.isFinite(workspaceWidth) || workspaceWidth <= 0) {
    issues.push("عرض مساحة العمل غير صالح.");
  }

  if (!Number.isFinite(workspaceLength) || workspaceLength <= 0) {
    issues.push("طول مساحة العمل غير صالح.");
  }

  if (rooms.length === 0) {
    issues.push("أضف منطقة واحدة على الأقل قبل توليد البرومبت.");
  }

  rooms.forEach((room, index) => {
    const label = room.name || `المنطقة ${index + 1}`;
    if (room.x === null || room.y === null) {
      issues.push(`حدد موقع "${label}" على المخطط قبل التوليد.`);
    }
    if (!Number.isFinite(room.width) || room.width <= 0 || !Number.isFinite(room.length) || room.length <= 0) {
      issues.push(`أبعاد "${label}" يجب أن تكون أكبر من صفر.`);
    }
  });

  return issues;
}

export function calculateSpatialDescription(
  zones: Pick<PromptRoom, "name" | "x" | "y">[],
): string {
  const activeZones = zones.filter((zone) => zone.x !== null && zone.y !== null);

  if (activeZones.length === 0) {
    return "No spatial data provided. Place every zone on the canvas before generating a precision prompt.";
  }

  return activeZones
    .map((zone, index) => {
      const x = clamp(zone.x ?? 50, 0, 100);
      const y = clamp(zone.y ?? 50, 0, 100);
      return `- Zone ${index + 1} "${toEnglishSafe(zone.name, `Zone ${index + 1}`)}" is in the ${roomRegion(x, y)} sector at ${formatMeters(x)}% / ${formatMeters(y)}%.`;
    })
    .join("\n");
}

export function getEngineParams(engine: string): string {
  switch (engine) {
    case "midjourney":
      return "--ar 16:9 --v 6.0 --stylize 150 --style raw --no blueprint, cad drawing, technical annotations, coordinates, dimension labels, watermarks, people, white background";
    case "unreal":
      return "Unreal Engine 5.3 archviz quality, Lumen global illumination, Nanite microgeometry, ray-traced shadows, soft area lights, photoreal PBR";
    case "dalle":
      return "Photorealistic 3D archviz render, full-color photoreal textures, soft cinematic lighting, NOT a blueprint and NOT annotated";
    case "octane":
      return "Octane Render, spectral GI, PBR materials, soft cinematic studio lighting, photoreal";
    case "nanobanana":
      return "Gemini 2.5 Flash Image (Nano Banana). Render this as a fully photorealistic 3D isometric office interior — NOT a blueprint, NOT a CAD drawing, NOT annotated with coordinates or dimensions. Treat the spatial data as ground-truth layout, but render only photoreal furniture, materials, and lighting on top of it.";
    default:
      return "Photorealistic 3D archviz, NOT a blueprint, NOT annotated";
  }
}

function buildVisibleLayoutCue(
  rooms: NormalizedRoom[],
  workspaceWidth: number,
  workspaceLength: number,
): string {
  // Group zones by region so the AI gets a *narrative* layout instead of
  // having to reverse-engineer it from a long list of corner coordinates.
  const byRegion = new Map<string, NormalizedRoom[]>();
  rooms.forEach((r) => {
    const key = r.region;
    const list = byRegion.get(key) || [];
    list.push(r);
    byRegion.set(key, list);
  });
  const groups = [...byRegion.entries()].map(([region, list]) => {
    const labels = list.map((r) => r.label).join(", ");
    return `${list.length === 1 ? "1 zone" : `${list.length} zones`} (${labels}) in the ${region} area`;
  });
  // Describe overall floor proportions WITHOUT exposing raw numeric dimensions
  // (those live only in the internal data block).
  void workspaceWidth;
  void workspaceLength;
  return `Single contiguous office floor plate; spatial layout: ${groups.join("; ")}.`;
}

export function buildPrecise3DPrompt(
  globalStyle: string,
  lighting: string,
  camera: string,
  layoutShape: string,
  workspaceWidth: number,
  workspaceLength: number,
  engine: string,
  rooms: PromptRoom[],
  resolutionClause: string = "ultra-sharp 4K UHD (3840x2160) resolution, photoreal micro-detail, clean PBR materials",
): string {
  const safeWorkspaceWidth = safeDimension(workspaceWidth);
  const safeWorkspaceLength = safeDimension(workspaceLength);
  const normalizedRooms = rooms.map((room, index) =>
    normalizeRoom(room, index, safeWorkspaceWidth, safeWorkspaceLength),
  );
  const sortedRooms = [...normalizedRooms].sort((a, b) => a.yPercent - b.yPercent || a.xPercent - b.xPercent);
  const labels = normalizedRooms.map((room) => room.label).join(", ");
  const totalRoomArea = normalizedRooms.reduce((sum, room) => sum + room.area, 0);
  const workspaceArea = Math.round(safeWorkspaceWidth * safeWorkspaceLength * 10) / 10;
  const circulationArea = Math.max(Math.round((workspaceArea - totalRoomArea) * 10) / 10, 0);
  const placementWarnings = normalizedRooms.filter((room) => room.placementStatus === "missing");
  const outOfBoundsRooms = normalizedRooms.filter(
    (room) =>
      room.leftXM < 0 ||
      room.topYM < 0 ||
      room.rightXM > safeWorkspaceWidth ||
      room.bottomYM > safeWorkspaceLength,
  );
  const adjacencies = buildAdjacencies(normalizedRooms);
  const walls = buildWallSegments(normalizedRooms);
  const asciiDiagram = buildAsciiDiagram(normalizedRooms, safeWorkspaceWidth, safeWorkspaceLength);
  const engineParams = getEngineParams(engine);
  const drawingCodes = buildDrawingCodes(
    normalizedRooms,
    safeWorkspaceWidth,
    safeWorkspaceLength,
    globalStyle,
    lighting,
    camera,
    layoutShape,
    engine,
    adjacencies,
    walls,
  );

  const cornerLines = normalizedRooms.map(
    (room) =>
      `  ${room.label}  TL=(${formatMeters(room.leftXM)},${formatMeters(room.topYM)})  TR=(${formatMeters(room.rightXM)},${formatMeters(room.topYM)})  BR=(${formatMeters(room.rightXM)},${formatMeters(room.bottomYM)})  BL=(${formatMeters(room.leftXM)},${formatMeters(room.bottomYM)})  ${formatMeters(room.width)}×${formatMeters(room.length)}m  facing ${room.directionLabel}`,
  );

  const visibleLayout = buildVisibleLayoutCue(normalizedRooms, safeWorkspaceWidth, safeWorkspaceLength);
  const styleEnglish = extractEnglish(globalStyle, "Modern Corporate");
  const lightingEnglish = extractEnglish(lighting, "Natural and warm daylight");
  const cameraEnglish = extractEnglish(camera, "Isometric top-down view");
  const layoutEnglish = extractEnglish(layoutShape, "rectangular");

  // The MASTER PROMPT is now purely VISUAL DIRECTION. It NEVER lists raw
  // numeric coordinates — those moved to the hidden internal block below so
  // the image model doesn't print them on the floor.
  const masterPrompt = [
    `Photorealistic 3D isometric architectural visualization of a fully furnished ${styleEnglish} office interior — rendered like an Unreal Engine 5 / Octane archviz still, NOT a blueprint, NOT a CAD drawing, NOT a hand-drawn floor plan, NOT a technical diagram with annotations.`,
    `Single-storey open-plan office floor plate (${layoutEnglish}), captured from a ${cameraEnglish.toLowerCase()} angle so the entire floor is visible in one frame, all outer walls tight to the frame edges, no white margins or empty background.`,
    `Floor surface: polished grey concrete with subtle reflections; outer walls: matte white; ceiling removed for the isometric view.`,
    `Lighting: ${lightingEnglish}, soft realistic shadows from real ceiling fixtures (recessed downlights and pendant lamps where appropriate), no flat ambient.`,
    `The floor contains exactly ${normalizedRooms.length} zones with these short codes: ${labels}.`,
    `Floor labels rule: render each zone's short code (e.g. "${normalizedRooms[0]?.label || "GM1"}") as a small subtle dark-grey vinyl floor decal — small relative to the furniture, centered inside that zone's footprint. Render NOTHING ELSE as text on the floor — no coordinates, no corner letters, no dimensions, no percentages, no zone categories, no notes.`,
    `Spatial layout: ${visibleLayout}`,
    `Per-zone visual direction (render each zone fully furnished as described, not as an empty rectangle): ${sortedRooms.map(roomNarrative).join(" ")}`,
    `Adjacencies: ${buildAdjacencySummary(adjacencies)}.`,
    `Shared walls: ${buildWallSummary(walls)}.`,
    `All remaining floor area between zones is clean polished concrete circulation — leave it empty, no rugs, no scattered objects, no decorative props.`,
    `Final render aesthetic: ${styleEnglish}, ${lightingEnglish}, photoreal PBR materials, crisp wall edges, accurate human-scale proportions, ${resolutionClause}. ${engineParams}`,
  ].join(" ");

  const negativeBlock = [
    "DO NOT render this as a blueprint, CAD drawing, architectural plan with annotations, top-down 2D diagram, or hand sketch — render it as a photorealistic 3D isometric scene with real materials and shadows.",
    "DO NOT print any coordinates (TL=, TR=, BR=, BL=, X=, Y=), corner letters, percentages, north arrows, scale bars, dimension lines, leader lines, callouts, or designer notes anywhere in the image.",
    "DO NOT print any numeric dimensions or measurements anywhere in the image — neither the room sizes, the desk sizes, the table sizes, the chair counts, the monitor sizes, nor any other figure. No metric values (m, cm), no imperial values (\", ft), no fractions. The desks, tables, chairs, counters and walls must appear as plain rendered objects with NO text, numbers, or labels on or beside them.",
    "The ONLY text allowed in the entire image is the short zone code (e.g. the zone's identifier such as a small alphanumeric tag) rendered as a single small subtle dark-grey floor decal per zone, centered inside that zone.",
    "DO NOT leave any zone empty — every workstation must have a desk, chair, monitor, keyboard; every meeting room must have a table AND chairs around it; every reception must have a counter AND seating.",
    "DO respect each zone's stated orientation: the desk/table/counter must face the direction listed for that zone, and must be either pushed against the corresponding wall (if the zone says 'attached') or centered freely in the zone (if the zone says 'free').",
    "DO respect each zone's stated table shape (rectangular, round, oval, U-shaped, or L-shaped) — render the actual physical shape, do not substitute a different shape.",
    "DO NOT invent additional rooms, partitions, hallways, doors, windows, staircases, or extra walls beyond those listed.",
    "DO NOT change any zone's position, size, or rotation; do not swap labels between zones.",
    "DO NOT add people, mannequins, animals, watermarks, logos, or signage other than what is explicitly described.",
    "DO NOT crop, rotate, mirror, or skew the overall floor plate; preserve the listed bounds.",
  ].join(" ");

  const warningText = [
    placementWarnings.length > 0
      ? `تنبيه: توجد ${placementWarnings.length} منطقة بدون موقع؛ تم عرضها في المعاينة فقط عند مركز المساحة، ولن يسمح زر التوليد النهائي بذلك.`
      : null,
    outOfBoundsRooms.length > 0
      ? `تنبيه: ${outOfBoundsRooms.map((room) => room.label).join("، ")} تمتد خارج حدود المساحة حسب مركزها وأبعادها.`
      : null,
    totalRoomArea > workspaceArea
      ? `تنبيه: مجموع مساحات الغرف (${formatMeters(totalRoomArea)} م2) أكبر من المساحة الكلية (${formatMeters(workspaceArea)} م2).`
      : null,
  ].filter(Boolean);

  return `### [MASTER PROMPT — copy this block into AI Studio]
\`\`\`
${masterPrompt}

[STRICT NEGATIVE CONSTRAINTS]
${negativeBlock}
\`\`\`

### [INTERNAL LAYOUT DATA — for the model's spatial reasoning ONLY, do NOT render any of this as visible text or annotations on the image]

ASCII floor diagram (each cell ≈ ${formatMeters(safeWorkspaceWidth / ASCII_TARGET_WIDTH)}m wide; this is a guide for placement, not something to draw):
\`\`\`
${asciiDiagram}
\`\`\`

Per-zone bounding boxes (top-left origin, meters; ground truth for placement only — never render as text):
\`\`\`
${cornerLines.join("\n")}
\`\`\`

Machine-readable layout data (use to verify spatial accuracy; never render):
\`\`\`json
${JSON.stringify(drawingCodes, null, 2)}
\`\`\`

### [TECHNICAL ANALYSIS - بالعربية]
تم توليد هذا البرومبت محلياً وبشكل حتمي من بيانات المشروع، بدون إعادة صياغة من نموذج AI. مساحة العمل الكلية ${formatMeters(safeWorkspaceWidth)}م × ${formatMeters(safeWorkspaceLength)}م = ${formatMeters(workspaceArea)}م². مجموع مساحات المناطق المحددة ${formatMeters(totalRoomArea)}م²، والممرات المتبقية ${formatMeters(circulationArea)}م². عدد المناطق ${normalizedRooms.length} والتسميات ${labels}. الإحداثيات الدقيقة موجودة في كتلة "INTERNAL LAYOUT DATA" أعلاه — هذه الكتلة لتعليمات المحرك فقط ولا يجب أن تظهر كنصوص على الصورة النهائية.
${warningText.length > 0 ? `\n${warningText.join("\n")}` : ""}`;
}
