# Plan: Place and Persist a Building on the Isometric Board

## Goal

Allow the user to click a board tile and place a building using the 2nd tile from `app/assets/images/tilesheet.png`, then persist that placement through Rails so the same state is restored after a page reload.

## Assumption

- The tilesheet is a `4 x 2` grid of `134 x 128` tiles.
- “2nd tile” means the tile in the top row, second column, so its texture frame is `Rectangle(134, 0, 134, 128)`.

If that indexing is not correct, only the texture rectangle changes; the rest of the plan stays the same.

## Scope

- Support one building type for now.
- Place the building on a clicked ground tile.
- Save the placement immediately to the server.
- Reload saved placements when the page boots.
- Keep existing camera pan and zoom behavior intact.

## Suggested Data Shape

Use a dedicated model such as `BuildingPlacement` with:

- `row:integer`
- `col:integer`
- `building_key:string`
- timestamps

Recommended constraints:

- `null: false` on all gameplay columns
- unique index on `[row, col]` so only one building can occupy a tile
- model validations for `row` and `col` being inside the current `10 x 10` board
- validation or enum limiting `building_key` to `"tile_2"` for now

## Implementation Steps

### 1. Add persistence for board placements

- Generate a migration for `building_placements`.
- Add the unique database index on `[row, col]`.
- Create `app/models/building_placement.rb` with presence and bounds validations.

This gives us a durable source of truth in SQLite instead of storing placements only in Pixi memory.

### 2. Expose placements through a small JSON API

Add a controller such as `BoardBuildingsController` or `BuildingPlacementsController` with:

- `index` to return all saved placements
- `create` to save a new placement

Recommended routes:

```ruby
resources :building_placements, only: [:index, :create], defaults: { format: :json }
```

Request payload:

```json
{ "building_placement": { "row": 3, "col": 4, "building_key": "tile_2" } }
```

Response behavior:

- `201 Created` with the saved placement JSON on success
- `422 Unprocessable Entity` if the tile is already occupied or the coordinates are invalid

### 3. Load saved state when the page renders

There are two workable approaches:

1. Fetch placements from `/building_placements.json` during `initPixiApp()`
2. Preload them in `PagesController#index` and pass them into the Stimulus controller as JSON

For this app, preloading from Rails is the cleaner first step because there is only one board page and it avoids an extra boot-time request.

Suggested page flow:

- `PagesController#index` loads `@building_placements = BuildingPlacement.all`
- `app/views/pages/index.html.erb` passes serialized placements through a `data-*` value
- `pixi_controller.js` forwards those placements into `initPixiApp(...)`

### 4. Extract the building texture from the tilesheet

In `app/javascript/pixi_app.js`:

- Keep the existing ground texture extraction
- Add a second texture for the building tile:

```js
const buildingTexture = new Texture({
  source: baseTexture.source,
  frame: new Rectangle(134, 0, 134, 128)
})
```

Store texture lookup in a small map, for example:

```js
const texturesByKey = { tile_2: buildingTexture }
```

This makes it easy to add more building types later without rewriting placement logic.

### 5. Track grid metadata for each rendered tile

When creating the ground sprites:

- attach `row` and `col` metadata to each sprite
- make the tile clickable without interfering with drag-to-pan

Recommended pattern:

- keep `dragState` as the guard against accidental placement while panning
- only treat the interaction as a placement when pointer down/up stays under the drag threshold

Two clean options:

1. Register `pointertap` on each ground sprite
2. Keep a separate board hit-test function that converts pointer coordinates back into `(row, col)`

For the current codebase, `pointertap` on each tile sprite is the simpler first implementation.

### 6. Render building sprites above the ground layer

Add a helper such as `renderBuilding({ row, col, buildingKey })` in `pixi_app.js` that:

- computes the same isometric `screenX` and `screenY` as the ground tile
- creates a `Sprite(texturesByKey[buildingKey])`
- uses the same anchor convention as the board art
- sets a slightly higher `zIndex` than the floor tile so the building always appears above its base tile

Keep a client-side lookup like `placedBuildingsByCell.set(\`${row},${col}\`, sprite)` so the client can quickly check whether a tile is already occupied.

### 7. Send placement to Rails when a tile is clicked

On valid click:

- ignore the click if that tile already has a building
- send a `fetch("/building_placements", { method: "POST", ... })`
- include JSON body and Rails CSRF token
- only add the building sprite permanently after the server confirms success

Important details:

- read the CSRF token from the existing `<meta name="csrf-token">`
- disable duplicate in-flight submissions for the same tile
- show a minimal error path in the console for now if save fails

### 8. Rehydrate placements on reload

After the board is created:

- iterate through the preloaded placement array
- call `renderBuilding(...)` for each saved record

This is the step that makes page reloads restore the prior state rather than resetting to an empty board.

### 9. Add tests around persistence

Recommended minimum coverage:

- model test for bounds and uniqueness
- request/integration test for `POST /building_placements`
- request/integration test for `GET /building_placements`

If you want one higher-confidence UI check, add a system test that:

- loads the page
- places one building
- refreshes
- confirms the building still appears

## Suggested Order of Work

1. Create migration, model, and validations.
2. Add JSON routes and controller actions.
3. Preload placements in `PagesController#index` and pass them to Stimulus.
4. Add building texture extraction and `renderBuilding(...)` in `pixi_app.js`.
5. Add tile click handling with drag protection.
6. POST placements to Rails and render on success.
7. Rehydrate saved placements during initial board boot.
8. Add tests and manually verify reload persistence.

## Verification Checklist

- [ ] Clicking a tile places one building using the 2nd tilesheet tile.
- [ ] Dragging the board does not accidentally place buildings.
- [ ] A second click on an occupied tile is ignored or rejected cleanly.
- [ ] The browser sends a POST request when a building is placed.
- [ ] The placement row exists in SQLite after the request succeeds.
- [ ] Reloading the page shows the saved building in the same tile.
- [ ] Existing pan and zoom still work after placement support is added.

## Nice Follow-Ups

- Add support for removing or moving a placed building.
- Add a building palette instead of hard-coding `"tile_2"`.
- Add multiplayer broadcasting later with Action Cable if live sync becomes important.
