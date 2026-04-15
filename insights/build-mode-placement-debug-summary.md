# Build Mode Placement Debug Summary

## Session Goal

Fix the frontend issue where clicking the board in `Mode: Build` did not place a building and did not send a visible request to `POST /building_placements`.

## Initial Symptom

- the board rendered correctly
- pan mode worked
- build mode toggled correctly
- persisted buildings still rendered on reload
- clicking in build mode did nothing from the user's perspective

## Debugging Timeline

### 1. Added temporary console logging

Instrumentation was added to:

- `app/javascript/controllers/pixi_controller.js`
- `app/javascript/pixi_app.js`

The logs covered:

- mode changes
- pointer down / pointer up
- cell resolution
- tile tap handling
- persistence requests

### 2. Confirmed the DOM pointer path was working

The first useful browser output showed:

- `pointerdown`
- `pointerup`

But nothing after that.

That established:

- build mode state was being set correctly
- DOM pointer listeners were firing
- the failure was happening after the basic pointer lifecycle

### 3. Confirmed Pixi stage tap events were not firing

An attempted fix moved placement to Pixi `pointertap` handling on the stage.

The browser logs showed that:

- DOM `pointerdown` / `pointerup` fired
- Pixi `stageTap` logging never appeared

So the placement flow was moved back onto the reliable DOM `pointerup` path.

### 4. Found an invalid Pixi runtime API assumption

The next implementation tried to map DOM pointer coordinates through:

- `app.renderer.events.mapPositionToPoint(...)`

That failed at runtime with:

- `Cannot read properties of undefined (reading 'mapPositionToPoint')`

Fix:

- replaced that call with manual canvas-space mapping using `app.canvas.getBoundingClientRect()`
- converted DOM pointer coordinates into renderer coordinates directly

### 5. Found the real blocker in cell resolution

After the coordinate mapping fix, logs progressed to:

- `pointer:boardPoint`
- `resolveCell:outside-diamond`

No request was sent because the click was being rejected before `handleTileTap(...)` ran.

The key log looked like:

- inverse isometric math produced a nearby `(row, col)`
- the follow-up diamond hit-test rejected that candidate

So the interaction pipeline was alive, but cell selection was too brittle.

## Root Cause

The build click resolver in `app/javascript/pixi_app.js` depended on a single rounded `(row, col)` candidate derived from inverse isometric math.

Near tile edges, that rounded candidate could land on an adjacent tile. When that happened:

- the secondary diamond containment check ran against the wrong tile
- the click was rejected as `outside-diamond`
- `handleTileTap(...)` was never called
- no persistence request was sent

## Final Fix

The resolver was changed to be tolerant of edge cases:

1. Convert the DOM pointer event into canvas coordinates with `getBoundingClientRect()`.
2. Transform canvas coordinates into board coordinates with `boardContainer.toLocal(...)`.
3. Compute fractional isometric `rowFloat` / `colFloat`.
4. Evaluate nearby candidate cells using `floor`, `ceil`, and `round`.
5. Choose the best candidate by smallest diamond-distance score.
6. Accept that best match if it falls within a reasonable threshold.

This removed the failure mode where a correct click was rejected because only one rounded cell was considered.

## Result

Build mode placement now works.

Observed outcome:

- clicking in build mode resolves to a cell
- `handleTileTap(...)` runs
- the frontend sends the placement request
- the building renders successfully

## Files Updated During Debugging

- `app/javascript/pixi_app.js`
- `app/javascript/controllers/pixi_controller.js`

## Notes

- the current console logging is temporary debugging instrumentation and can be removed once no longer needed
- no additional backend changes were required for this fix
