# blueprint-3d-visualizer

[العربية](README.md)

**Draw a room layout on a 2D canvas. Get a deterministic architectural prompt, ready to paste into Google AI Studio.**

A blueprint editor that runs in the browser. It builds the prompt straight from your coordinates, with no language model in between. A project with only 2 zones gives a prompt of 171 lines and 10,742 characters. The code is 3,796 lines of TypeScript in 12 files.

## The problem

Image generation models read free text loosely. You ask for 3 rooms and get 5. You put a desk in the north-west corner, and it comes back in the center. You can send your layout to an LLM to write the prompt. Then the LLM rewrites your measurements as it likes. So every run gives a layout different from your real plan.

## How it works

1. You draw zones on a Fabric.js canvas with a grid. You drag to resize, and rotation snaps to 15 degrees.
2. Each zone gets a type from 13 room types. It also gets a partition type, furniture style, and features.
3. The converter computes the center of each zone in meters. It also computes bounds, direction, and logical sector (north-west / central / ...).
4. `promptBuilder.ts` builds the final prompt from this data as text. That file is 913 lines long.
5. You copy the prompt for your target engine. You can also export the plan as PNG, or make a full Python script.

The tool supports 5 output engines:

| Engine | Output format |
|---|---|
| Nano Banana (Gemini 2.5 Flash Image) | Prompt + ready-to-run Python script |
| Midjourney v6 | Prompt with `--ar --stylize --no` flags |
| DALL-E 3 | Text prompt |
| Unreal Engine 5 | Archviz scene description |
| Octane Render | Archviz scene description |

### Real output

Here is the builder on a 2-zone project (executive office + meeting room). The workspace is 20×12 meters.

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

**The problem:** the image model drifts away from the layout. An LLM in the middle adds more drift when it rewrites the text.

**The decision:** build the prompt 100% local and deterministic. The same layout repeats in 5 representations inside one prompt:

| Representation | What it pins down |
|---|---|
| Prose description per zone | Type, furniture, direction, sector |
| ASCII floor diagram | Relative position you can see, one cell ≈ 0.4 m |
| Four-corner coordinates | Exact bounds in meters for every zone |
| Adjacency matrix | Which zones share a wall (0.4 m tolerance) |
| JSON block | Raw data as the final reference |

**The cost:** a long prompt, 10,742 characters for only 2 zones. And a big builder, 913 lines in one file.

**The payoff:** the measurements stay the same in every run. No extra rooms appear.

## Running it

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

The app builds the prompt locally, so core use needs no API key. Only the generated Python script needs the `GEMINI_API_KEY` variable in `.env.example`.

Extras: you can save the whole project as a Base64 code and restore it later. You can export the plan as a PNG image. Undo works through a Zustand store.

| Library | Role |
|---|---|
| React 19 + Vite 6 + TypeScript | UI and build |
| Fabric.js 7 | Canvas, grid, and export |
| Zustand | State and undo history |
| Tailwind CSS 4 | Styling |

## Why I built it

I needed to turn real office layouts into 3D renders with no measurement drift.
Editing a 171-line prompt by hand breaks its consistency. The editor rebuilds it whole in one click.
