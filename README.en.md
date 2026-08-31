# blueprint-3d-visualizer

[العربية](README.md)

**Draw a room layout on a 2D canvas, get a deterministic architectural prompt ready to paste into Google AI Studio.**

A browser-based blueprint editor that assembles the prompt directly from your coordinates, with no intermediate language model. A project with just 2 zones compiles into a 171-line, 10,742-character prompt. The codebase is 3,796 lines of TypeScript across 12 files.

## The problem

Image generation models treat free-form descriptions loosely. Ask for 3 rooms, get 5. Place a desk in the north-west corner, watch it render in the center. And if you pass your layout through an LLM to write the prompt, it rewrites your measurements as it sees fit. The result: every generation produces a layout different from your actual plan.

## How it works

1. You draw zones on a gridded Fabric.js canvas, with drag-resize and rotation snapping to 15 degrees.
2. Each zone gets a type from 13 room types, plus a partition type, furniture style, and features.
3. The converter computes each zone's center in meters, its bounds, its direction, and its logical sector (north-west / central / ...).
4. `promptBuilder.ts` — all 913 lines of it — assembles the final prompt from this data as text.
5. You copy the prompt for the target engine, export the plan as PNG, or generate a complete Python script.

5 output engines are supported:

| Engine | Output format |
|---|---|
| Nano Banana (Gemini 2.5 Flash Image) | Prompt + ready-to-run Python script |
| Midjourney v6 | Prompt with `--ar --stylize --no` flags |
| DALL-E 3 | Text prompt |
| Unreal Engine 5 | Archviz scene description |
| Octane Render | Archviz scene description |

### Real output

Running the builder on a 2-zone project (executive office + meeting room) in a 20×12 meter workspace:

```
PROMPT_LINES=171
PROMPT_CHARS=10742

ASCII floor diagram (each cell ≈ 0.4m wide; this is a guide for placement):
+--------------------------------------------------------+
|############............................................|
|#PPPPPO1PPP#..........#GGGGGGGGGGGGGGGG#................|
|#PPPPPPPPPP#..........#GGGGGGGGM2GGGGGG#................|
|############..........#GGGGGGGGGGGGGGGG#................|
|......................##################................|
```

## The key design decision

**The problem:** the image model drifts from the layout, and an intermediate LLM adds more drift by paraphrasing.

**The decision:** 100% local, deterministic assembly — with the same layout repeated in 5 representations inside a single prompt:

| Representation | What it pins down |
|---|---|
| Prose description per zone | Type, furniture, direction, sector |
| ASCII floor diagram | Relative position visually, one cell ≈ 0.4 m |
| Four-corner coordinates | Exact bounds in meters for every zone |
| Adjacency matrix | Which zones share a wall (0.4 m tolerance) |
| JSON block | Raw data as the final reference |

**The cost:** a long prompt (10,742 characters for only 2 zones), and a heavyweight builder (913 lines in one file).

**The payoff:** measurements stay identical across generations, and no unrequested rooms appear.

## Running it

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

The prompt is built locally, so no API key is needed for core usage. The `GEMINI_API_KEY` variable in `.env.example` is only required by the generated Python script.

Extras: save the whole project as a Base64 code and restore it later, export the plan as a PNG image, and undo via a Zustand store.

| Library | Role |
|---|---|
| React 19 + Vite 6 + TypeScript | UI and build |
| Fabric.js 7 | Canvas, grid, and export |
| Zustand | State and undo history |
| Tailwind CSS 4 | Styling |

## Why I built it

I needed to turn real office layouts into 3D renders without measurement drift.
Hand-editing a 171-line prompt breaks its consistency; the editor regenerates it whole in one click.
