# Unresolved: Build Mode Does Not Place Buildings

## Current Status

As of April 15, 2026, the board renders, pan mode works, the mode toggle is visible, and persisted buildings loaded from the database render correctly.

The unresolved issue is that switching to `Mode: Build` still does not reliably create a building from the frontend. The user reports that no network request is visible when clicking the board in build mode.

## Confirmed Working

- The board canvas renders again after fixing the Stimulus connect/disconnect regression.
- The `Building` button toggles the UI between `Mode: Pan` and `Mode: Build`.
- Existing persisted buildings render on page load.
- Manual insertion into `building_placements` works and shows up on reload.
- Rails persistence endpoints and tests are passing.

## Confirmed Broken

- Clicking the board in `Mode: Build` does not produce a visible placement from the frontend.
- The user reported seeing no request fired from the browser when attempting to place a building.

## Debugging Notes

### 1. Initial regression after mode split

The board disappeared entirely after the first implementation pass.

Cause:

- `app/javascript/controllers/pixi_controller.js`
- `connect()` checked `this.isConnected` after async app initialization
- that caused the Pixi app to be destroyed immediately

Fix applied:

- changed the guard to `this.element.isConnected`

That restored board rendering.

### 2. CSP error found in browser console

The user reported this error:

```text
Connecting to 'data:image/png;base64,...' violates the following Content Security Policy directive: "connect-src 'self' https: blob:".
```

Cause:

- Pixi attempted a `connect-src`-governed fetch/request path against a `data:` URL
- `img-src` already allowed `data:`, but `connect-src` did not

Fix applied:

- updated `config/initializers/content_security_policy.rb`
- changed `policy.connect_src :self, :https, :blob`
- to `policy.connect_src :self, :https, :data, :blob`

Important:

- this requires a Rails server restart to take effect

This may have been blocking placement earlier, but it does not yet explain the remaining lack of frontend placement after the later changes.

### 3. Tile interaction path was likely brittle

Placement originally depended on Pixi tile-level interaction handlers:

- first via `pointertap`
- later via tile `pointerdown` / `pointerup`

Because drag state was handled through DOM pointer listeners on the canvas/window, the tile-level Pixi events were likely not a reliable source of truth once interaction modes were split.

### 4. Placement was moved to board-level pointer resolution

To reduce dependence on per-tile Pixi events, placement logic in `app/javascript/pixi_app.js` was changed to:

- keep drag detection at the DOM pointer level
- on `pointerup`, if in `build` mode and still tap-eligible:
- convert the client click point into board coordinates
- resolve the target `(row, col)`
- call the existing `handleTileTap(row, col)` persistence path

This should have produced a frontend request even without sprite-level Pixi click events.

The user still reported no visible request after this change.

## Most Likely Remaining Causes

### 1. Browser is still serving stale JavaScript

This is a strong candidate.

Reason:

- multiple frontend fixes were made in `app/javascript/pixi_app.js`
- if the browser did not reload the updated asset graph, the user may still be running an older event path

What to verify next:

- hard refresh the page
- restart `bin/dev` or the Rails server if not already restarted after the CSP change
- confirm the latest JS is actually loaded in the browser

### 2. The board-level cell resolution math is rejecting clicks

The click-to-cell logic now computes the target cell manually from camera-relative coordinates and then rejects points outside the diamond footprint.

Possible failure modes:

- the inverse isometric math is slightly off
- the tile hit diamond check is too strict
- camera scale/translation math is correct visually but wrong for click reconstruction

Symptom if true:

- `pointerup` fires
- but `resolveCellFromClientPoint(...)` returns `null`
- so no POST is attempted

### 3. Pointer events are not reaching the intended handler path

Another possibility is that:

- `pointerdown` on the canvas is recorded
- but the corresponding `window` `pointerup` path is not running as expected in the actual browser session

This is less likely than stale JS or bad click-to-cell resolution, but still possible.

## Recommended Next Debug Step

Add temporary runtime logging directly inside `app/javascript/pixi_app.js` for:

- `handlePointerDown`
- `handlePointerUp`
- `resolveCellFromClientPoint`
- `handleTileTap`
- `persistBuildingPlacement`

This would establish exactly where the path stops:

1. no pointer events
2. pointer events present but cell resolution returns `null`
3. `handleTileTap` runs but exits early
4. POST is attempted and fails

Without that instrumentation, the current state is still partially inferential.

## Relevant Files

- `app/javascript/pixi_app.js`
- `app/javascript/controllers/pixi_controller.js`
- `config/initializers/content_security_policy.rb`
- `app/views/pages/index.html.erb`
- `app/assets/stylesheets/application.css`

## Verification Performed So Far

- `bin/rails test` passes after each change
- database insertion via Rails runner works
- persisted building renders after reload

## Bottom Line

The persistence layer appears to work.

The unresolved bug is still in the frontend placement interaction path, most likely one of:

- stale frontend assets in the browser
- incorrect click-to-cell resolution in build mode
- pointer events not reaching the final placement handler as expected

## Resolution

The placement bug was fixed in `app/javascript/pixi_app.js`.

What changed:

- build placement no longer depends on reconstructing board coordinates from DOM `clientX` / `clientY`
- the app now listens for Pixi `pointertap` events on the stage in build mode
- click coordinates are converted with `boardContainer.toLocal(event.global)`, which keeps placement in Pixi's own coordinate space
- the diamond hit test now uses the tile footprint height (`TILE_HALF_HEIGHT`) instead of the full texture height (`TILE_HEIGHT`)

Why this fixed it:

- the old path mixed DOM-space pointer coordinates with Pixi camera-space transforms, which made click resolution fragile
- the old hit test also used the full sprite texture height, not the actual board diamond footprint
- together, those issues could cause the build click to resolve to `null`, so no placement request was sent
