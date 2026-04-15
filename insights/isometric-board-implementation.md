# Isometric Board Implementation Summary

1. **Asset Loading & Texture Extraction**:
   - Modified `app/views/pages/index.html.erb` to pass the `tilesheet.png` URL into the Stimulus controller using the `data-pixi-tilesheet-url-value` attribute.
   - Handled this value in `pixi_controller.js` and passed it through to `initPixiApp()`.
   - Updated `pixi_app.js` to asynchronously load the image using `PIXI.Assets.load`.
   - Created a specific sub-texture using `new Texture(...)` to target the bottom-left ground block (134x128px starting at `y: 128`).

2. **Isometric Coordinate System Math & Board Generation**:
   - Implemented a 10x10 grid loop.
   - Converted 2D grid `(col, row)` loops into screen coordinates `(screenX, screenY)` using standard isometric math.
   - Applied `zIndex = col + row` and enabled `sortableChildren = true` to ensure the tiles correctly overlap from back to front.
   - Centered the `boardContainer` within the canvas.

3. **Orthographic Camera Implementation**:
   - Embedded the `boardContainer` inside a `camera` container (`PIXI.Container`), which itself was added to the `app.stage`.
   - Set up interactive pointer events (`pointerdown`, `pointermove`, `pointerup`, and `pointerupoutside`) on the entire `app.stage` (via an expansive `hitArea`) for easy panning.
   - Set up a `wheel` event listener on `app.canvas` to adjust `camera.scale` while also offsetting the `camera.x` and `camera.y` positions so zooming is centered directly relative to your mouse pointer.
