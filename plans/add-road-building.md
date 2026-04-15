# Add Road Building

## Goal

Add road placement to the board. The player enters road-build mode, then drags across tiles to paint a road segment. Direction is auto-detected from the drag axis:

- **Drag along the col axis** (bottom-right / top-left in screen space) → places `road_col` tiles (3rd-from-last tile in tilesheet; cars travel top-left ↔ bottom-right).
- **Drag along the row axis** (bottom-left / top-right in screen space) → places `road_row` tiles (last tile in tilesheet; cars travel top-right ↔ bottom-left).

## Tilesheet Coordinates

Each tile is 134 × 128 px. The sheet is a 4 × 2 grid (buildings on row 0, ground/road on row 1).

| Key | Tile index | x offset | y offset | Description |
|-----|-----------|----------|----------|-------------|
| `road_col` | 5 (3rd from end) | 134 | 128 | Road, top-left ↔ bottom-right |
| `road_row` | 7 (last) | 402 | 128 | Road, top-right ↔ bottom-left |

## Drag Direction Logic

In isometric screen space:
- Moving along the **col axis** (row constant, col varies) shifts the cursor toward bottom-right / top-left.
- Moving along the **row axis** (col constant, row varies) shifts the cursor toward bottom-left / top-right.

Detect axis by comparing the absolute screen-space displacement at the moment the drag threshold is crossed:
- `|dx| > |dy|` → col axis → `road_col`
- `|dy| >= |dx|` → row axis → `road_row`

Lock the axis for the entire drag gesture so a single stroke stays straight.

Once the axis is determined, collect all cells between the pointer-down cell and the current pointer cell along that axis. Paint each un-occupied cell.

## Data Model

Reuse the existing `BuildingPlacement` model with `building_key` set to `road_col` or `road_row`. No schema changes needed.

## Files to Change

### `app/javascript/pixi_app.js`

1. Extract two new textures:
   ```js
   const roadColTexture = new Texture({ source: baseTexture.source, frame: new Rectangle(134, 128, TILE_WIDTH, TILE_HEIGHT) })
   const roadRowTexture = new Texture({ source: baseTexture.source, frame: new Rectangle(402, 128, TILE_WIDTH, TILE_HEIGHT) })
   ```
2. Register them in `texturesByKey`:
   ```js
   road_col: roadColTexture,
   road_row: roadRowTexture,
   ```
3. Extend valid interaction modes to include `"road"`.
4. Add road drag state:
   - `roadDragAxis: null` — `"col"` | `"row"` | `null`
   - `roadDragOriginCell: null`
5. In `handlePointerMove`, when `interactionMode === "road"` and drag threshold is crossed:
   - Determine axis from accumulated dx/dy if not yet locked.
   - Compute the line of cells from origin to current cell along the locked axis.
   - For each new cell in that line, call `handleRoadTilePaint(row, col, buildingKey)` (non-async preview; skip already-occupied cells).
6. Add `handleRoadTilePaint` — renders a ghost preview sprite (semi-transparent) to show what will be placed.
7. On `pointerup` in `"road"` mode: finalize the drag, persist each painted cell via `persistBuildingPlacement`, convert ghosts to permanent sprites.
8. On `pointerdown` in `"road"` mode: record `roadDragOriginCell`, reset axis lock.
9. Export `setInteractionMode` accepting `"road"` in addition to `"pan"` and `"build"`.

### `app/javascript/controllers/pixi_controller.js`

1. Add `static targets` entry for `roadButton`.
2. Add `toggleRoadMode()` action.
3. Extend `setMode` to accept `"road"`.
4. Extend `syncModeUi` to toggle `is-active` on `roadButton` and update the mode label.

### `app/views/pages/index.html.erb`

Add a Road button next to the Building button:
```erb
<button type="button"
        class="board-button"
        data-action="pixi#toggleRoadMode"
        data-pixi-target="roadButton"
        aria-pressed="false">
  Road
</button>
```

## Behaviour Summary

1. Click **Road** button → enters `"road"` mode; cursor changes to crosshair.
2. Press pointer on a tile → records origin cell; no placement yet.
3. Drag past the drag threshold → axis locks; semi-transparent road tiles appear on all cells along the locked axis from origin to current pointer.
4. Release pointer → all previewed cells are persisted (skipping already-occupied cells); sprites become fully opaque.
5. Clicking **Road** again (or switching to **Building** / **Pan**) exits road mode.
6. Page reload rehydrates road tiles from `building_placements` using the existing `buildingKey` dispatch in `renderBuilding`.

## Out of Scope

- Road intersections or auto-connecting tiles.
- Visual transitions or animations on placement.
- Removing / bulldozing roads.
