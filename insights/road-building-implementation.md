# Road Building Implementation

## What Was Built

Added road placement to the isometric board. Players enter road mode, drag across tiles to paint a road segment, and can rotate the segment 90 degrees mid-drag with `R`.

## Changes

### `app/models/building_placement.rb`
- Added `road_col` and `road_row` to `BUILDING_KEYS` so the server validates and persists them.

### `app/javascript/pixi_app.js`
- Extracted two new textures from the tilesheet:
  - `roadColTexture` — frame at x=134, y=128 (col-axis road)
  - `roadRowTexture` — frame at x=402, y=128 (row-axis road)
- Registered both in `texturesByKey` under keys `road_col` / `road_row`.
- Added `roadState` object tracking: `axis`, `originCell`, `currentCell`, `ghostSprites` (Map).
- Added `clearRoadGhosts()` — removes and destroys all ghost sprites from the board container.
- Added `handleRoadTilePaint(row, col, buildingKey)` — creates a semi-transparent (alpha 0.5) sprite at a cell without committing it to `placedBuildingsByCell`.
- Added `repaintRoadGhosts()` — clears ghosts and repaints the full segment line from `originCell` to `currentCell` along the locked axis. Used by both pointer move and the rotate key.
- `handlePointerDown`: records `originCell` and resets axis lock when in `"road"` mode.
- `handlePointerMove`: on first move past drag threshold, locks axis from accumulated `dx`/`dy` (`|dx| > |dy|` → col, else row); tracks `currentCell`; calls `repaintRoadGhosts()`.
- `handlePointerUp`: promotes all ghost sprites to permanent (alpha 1, registered in `placedBuildingsByCell`), fires `persistBuildingPlacement` for each cell (fire-and-forget with error logging).
- Added `handleKeyDown`: pressing `R` while an axis is locked flips `axis` between `"col"` and `"row"` and calls `repaintRoadGhosts()`.
- `setInteractionMode`: now accepts `"road"`; clears ghosts and resets all road state on mode switch.
- `updateCursor`: road mode shows `crosshair`, matching build mode.
- Registered and cleaned up `handleKeyDown` on `window` alongside the other event listeners.

### `app/javascript/controllers/pixi_controller.js`
- Added `roadButton` to `static targets`.
- Added `toggleRoadMode()` — toggles between `"road"` and `"pan"`.
- Extended `setMode` and `syncModeUi` to handle `"road"`: toggles `is-active` on `roadButton`, sets `aria-pressed`, updates mode label to `"Road"`.

### `app/views/pages/index.html.erb`
- Added a Road button next to Building, wired to `pixi#toggleRoadMode` with `data-pixi-target="roadButton"`.

## Key Design Decisions

- **Reused `BuildingPlacement`** — roads are stored as building placements with a road-specific `building_key`. No schema changes.
- **Ghost sprite pattern** — semi-transparent sprites are added to the board during drag and promoted to permanent on pointer up. This gives immediate visual feedback without premature persistence.
- **Axis locked for the whole gesture** — auto-detected from the first move past the drag threshold; prevents diagonal roads.
- **`R` key rotates mid-drag** — flips the locked axis and immediately repaints ghosts using `currentCell`. Only active while a drag is in progress (`dragState.hasMoved` must be true).
- **Fire-and-forget persistence** — road tiles are visually committed immediately on pointer up; server errors are logged but don't roll back the visual state (consistent with the existing building placement approach).

## Axis / Tile Key Mapping

| Drag direction | `roadState.axis` | `buildingKey` | Tilesheet frame |
|---|---|---|---|
| `\|dx\| > \|dy\|` (col varies, row fixed) | `"col"` | `road_col` | x=134, y=128 |
| `\|dy\| >= \|dx\|` (row varies, col fixed) | `"row"` | `road_row` | x=402, y=128 |
