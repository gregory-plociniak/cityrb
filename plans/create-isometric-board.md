# Plan: Create Simple Isometric Board with PixiJS

This document outlines the steps to implement a simple isometric board in PixiJS, using the `app/assets/images/tilesheet.png` asset. The tiles are 134px wide and 128px high, and we will implement a basic orthographic camera (pan and zoom) to navigate the board.

## 1. Asset Loading & Texture Extraction

**Goal:** Load the spritesheet and extract the specific floor tile to use for the board.

*   Load `app/assets/images/tilesheet.png` using `PIXI.Assets.load`.
*   Since the tilesheet has multiple tiles (appears to be a 4x2 grid), we need to extract a single repeating tile (e.g., the plain ground block on the bottom left).
*   Use `new PIXI.Texture(baseTexture, new PIXI.Rectangle(x, y, 134, 128))` to create a specific texture for the plain ground tile.

## 2. Isometric Coordinate System Math

**Goal:** Translate 2D grid coordinates (column, row) into isometric screen coordinates (x, y).

*   **Tile Dimensions:** Width `W = 134px`, Total Height `H = 128px`.
*   **Isometric Grid Height:** The top "diamond" surface of an isometric tile is typically half its width. So, the grid vertical step `h` should be approximately `134 / 2 = 67px`.
*   **Coordinate Formula:**
    *   `screenX = (col - row) * (W / 2)`
    *   `screenY = (col + row) * (h / 2)`
    *   *(Note: Adjust the `h` value slightly if the specific art requires a different vertical overlap).*

## 3. Board Generation & Depth Sorting

**Goal:** Render a grid of tiles and ensure they overlap correctly from back to front.

*   Create a `boardContainer` (a `PIXI.Container`) to hold all tiles.
*   Enable `sortableChildren = true` on the `boardContainer` to easily manage overlapping.
*   Loop through rows (`0` to `size`) and columns (`0` to `size`):
    *   Create a `new PIXI.Sprite(groundTexture)`.
    *   Set its anchor. Often `sprite.anchor.set(0.5, 1)` (bottom center) or `(0.5, 0)` is easiest for isometric math, depending on the math chosen. With `(0.5, 0)`, the coordinate represents the top tip of the diamond.
    *   Apply the `screenX` and `screenY` formulas to `sprite.x` and `sprite.y`.
    *   Set `sprite.zIndex = col + row` (or `sprite.y`) so tiles drawn "lower" on the screen appear in front of tiles "higher" up.
    *   Add the sprite to `boardContainer`.

## 4. Orthographic Camera Implementation

**Goal:** Allow panning (drag to move) and zooming (scroll to scale) around the isometric board.

*   PixiJS renders 2D orthographically by default. A "camera" is simply a `PIXI.Container` that holds the `boardContainer`.
*   **Panning:**
    *   Make the app stage or camera container interactive: `camera.eventMode = 'static'`.
    *   Listen to `pointerdown`, `pointermove`, and `pointerup` / `pointerupoutside`.
    *   On `pointerdown`, record the starting coordinates.
    *   On `pointermove` (while dragging), update `camera.x` and `camera.y` by the delta of the mouse movement.
*   **Zooming:**
    *   Listen to the standard browser `wheel` event on the canvas.
    *   Scale the `camera.scale.x` and `camera.scale.y` up or down based on the `wheel` delta.
    *   *Advanced:* Offset `camera.x` and `camera.y` during the zoom so that the zoom centers on the mouse cursor rather than the top-left of the container.

## 5. Integration with Rails & Stimulus

*   Implement the setup logic inside `app/javascript/pixi_app.js`.
*   Initialize the `PixiApp` from the Stimulus controller (`app/javascript/controllers/pixi_controller.js`), passing the canvas element.
*   Provide the path to `tilesheet.png` using an asset path helper in your ERB view, or let Vite/Sprockets handle the asset URL resolution so PixiJS can fetch it.

## Next Steps to Implement:
1. Update `pixi_app.js` with the camera container and asset loader.
2. Write a function `createIsometricGrid(cols, rows)`.
3. Add panning pointer events and wheel zooming events.
