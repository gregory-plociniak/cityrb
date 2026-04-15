# Building Requires Road Adjacency

## Goal

A building (`tile_2`) can only be placed on a cell that is orthogonally adjacent (up, down, left, right) to at least one road tile (`road_col`, `road_row`, or `road_cross`). If no road is adjacent, the placement is silently rejected on the frontend. The backend enforces the same rule as a safety net.

## Key Design Decisions

- **Orthogonal adjacency only** — diagonal neighbors (e.g. `(row-1, col-1)`) are not considered "near a road". Only the four cardinal neighbors: `(row-1, col)`, `(row+1, col)`, `(row, col-1)`, `(row, col+1)`.
- **Frontend check first** — `handleTileTap` already has access to `placedBuildingsByCell` which contains every placed tile keyed by `"row,col"`. No network round-trip is needed for the check. Reject before calling `persistBuildingPlacement`.
- **Visual feedback on rejection** — briefly flash the target ground tile red (alpha pulse) so the player understands why the click did nothing.
- **Backend validation as safety net** — the model validates adjacency via a database query. This prevents API abuse and keeps data consistent even if the frontend check is bypassed.
- **Roads are not affected** — this constraint applies to `tile_2` only. Road placement is unchanged.

## Changes

### `app/models/building_placement.rb`

Add a custom validation that fires only for `tile_2` placements:

```ruby
validate :road_adjacent, if: -> { building_key == "tile_2" }

private

def road_adjacent
  road_keys = %w[road_col road_row road_cross]
  neighbors = [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1]
  ].select { |r, c| r.between?(0, BOARD_SIZE - 1) && c.between?(0, BOARD_SIZE - 1) }

  adjacent_road = neighbors.any? do |r, c|
    BuildingPlacement.exists?(row: r, col: c, building_key: road_keys)
  end

  errors.add(:base, "must be placed adjacent to a road") unless adjacent_road
end
```

This runs at most 4 `EXISTS` queries (one per in-bounds neighbor). The unique index on `(row, col)` makes each lookup fast.

### `app/javascript/pixi_app.js`

#### 1. Helper: `isRoadKey(buildingKey)`

Add near the other helpers (e.g. next to `isPerpendicularRoad`):

```js
const isRoadKey = (key) => key === "road_col" || key === "road_row" || key === "road_cross"
```

#### 2. Helper: `hasAdjacentRoad(row, col)`

Checks the four orthogonal neighbors in `placedBuildingsByCell`:

```js
const hasAdjacentRoad = (row, col) => {
  const neighbors = [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ]
  return neighbors.some(([r, c]) => {
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false
    const cell = placedBuildingsByCell.get(cellKey(r, c))
    return cell && isRoadKey(cell.buildingKey)
  })
}
```

#### 3. Update `handleTileTap` to check adjacency

In `handleTileTap`, after the existing occupied-cell guard, add the adjacency check before placement:

```js
const handleTileTap = (row, col) => {
  if (!dragState.tapEligible) return
  if (placedBuildingsByCell.has(cellKey(row, col))) return

  // New: reject if no adjacent road
  if (!hasAdjacentRoad(row, col)) {
    flashRejection(row, col)
    return
  }

  renderBuilding({ row, col, buildingKey: "tile_2" })
  persistBuildingPlacement({ row, col, buildingKey: "tile_2" }).catch((error) => {
    console.error("Failed to persist building placement", error)
  })
}
```

#### 4. Add `flashRejection(row, col)` for visual feedback

Briefly tints the ground tile red to signal an invalid placement:

```js
const flashRejection = (row, col) => {
  const sprite = groundSpritesByCell.get(cellKey(row, col))
  if (!sprite) return
  sprite.tint = 0xff4444
  setTimeout(() => { sprite.tint = 0xffffff }, 300)
}
```

`tint` is a PixiJS sprite property that multiplies the texture colour. Resetting it to `0xffffff` (white) restores the original appearance.

## Implementation Steps

1. Add `road_adjacent` validation to `BuildingPlacement` model.
2. Add `isRoadKey` helper to `pixi_app.js`.
3. Add `hasAdjacentRoad` helper to `pixi_app.js`.
4. Add `flashRejection` helper to `pixi_app.js`.
5. Update `handleTileTap` to call `hasAdjacentRoad` before placement and `flashRejection` on rejection.
6. Verify: place a road, then click an adjacent cell → building appears. Click a non-adjacent cell → red flash, no building.

## What Is Not Changing

- Road placement mode — roads can be placed anywhere, no adjacency constraint.
- `renderBuilding` and `persistBuildingPlacement` — called only after the check passes, so no changes inside them.
- The existing occupied-cell guard in `handleTileTap` — still runs first (buildings cannot stack).
- Database schema — no migration needed; the validation is pure Ruby logic.
- Reset flow — unchanged; destroy-all wipes all placements regardless of type.
