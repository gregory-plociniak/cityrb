import { Application, Assets, Texture, Rectangle, Container, Sprite, Point } from "pixi.js"

const BOARD_SIZE = 10
const TILE_WIDTH = 134
const TILE_HEIGHT = 128
const TILE_HALF_HEIGHT = 67
const BUILDING_KEY = "tile_2"

export async function initPixiApp(containerId, { tilesheetUrl, buildingPlacements = [] }) {
  const containerElement = document.getElementById(containerId)
  const app = new Application()
  let interactionMode = "pan"
  const globalPointerPoint = new Point()

  await app.init({
    background: "#1099bb",
    resizeTo: containerElement,
  })

  containerElement.appendChild(app.canvas)

  // 1. Asset Loading & Texture Extraction
  const baseTexture = await Assets.load(tilesheetUrl)

  // Create a specific texture for the plain ground tile (bottom left)
  // 134px wide, 128px high
  const groundTexture = new Texture({
    source: baseTexture.source,
    frame: new Rectangle(0, 128, TILE_WIDTH, TILE_HEIGHT)
  })

  const buildingTexture = new Texture({
    source: baseTexture.source,
    frame: new Rectangle(TILE_WIDTH, 0, TILE_WIDTH, TILE_HEIGHT)
  })

  const roadColTexture = new Texture({ source: baseTexture.source, frame: new Rectangle(134, 128, TILE_WIDTH, TILE_HEIGHT) })
  const roadRowTexture = new Texture({ source: baseTexture.source, frame: new Rectangle(402, 128, TILE_WIDTH, TILE_HEIGHT) })

  const texturesByKey = {
    [BUILDING_KEY]: buildingTexture,
    road_col: roadColTexture,
    road_row: roadRowTexture,
  }

  // 4. Orthographic Camera Implementation
  const camera = new Container()
  app.stage.addChild(camera)

  // 3. Board Generation & Depth Sorting
  const boardContainer = new Container()
  boardContainer.sortableChildren = true
  camera.addChild(boardContainer)

  const placedBuildingsByCell = new Map()
  const pendingPlacements = new Set()

  const roadState = {
    axis: null,
    originCell: null,
    ghostSprites: new Map(),
  }

  const cellKey = (row, col) => `${row},${col}`
  const screenPositionFor = (row, col) => ({
    x: (col - row) * (TILE_WIDTH / 2),
    y: (col + row) * (TILE_HALF_HEIGHT / 2),
  })

  const renderBuilding = ({ row, col, buildingKey }) => {
    const key = cellKey(row, col)

    if (placedBuildingsByCell.has(key)) return placedBuildingsByCell.get(key)

    const texture = texturesByKey[buildingKey]

    if (!texture) {
      console.error(`Unknown building key: ${buildingKey}`)
      return null
    }

    const sprite = new Sprite(texture)
    const { x, y } = screenPositionFor(row, col)

    sprite.anchor.set(0.5, 0)
    sprite.x = x
    sprite.y = y
    sprite.zIndex = row + col + 0.5

    boardContainer.addChild(sprite)
    placedBuildingsByCell.set(key, sprite)

    return sprite
  }

  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content

  const persistBuildingPlacement = async ({ row, col, buildingKey }) => {
    const response = await fetch("/building_placements", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
        "Accept": "application/json",
      },
      body: JSON.stringify({
        building_placement: { row, col, building_key: buildingKey }
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      const details = payload.errors?.join(", ") || `Request failed with status ${response.status}`
      throw new Error(details)
    }

    return payload
  }

  const handleTileTap = async (row, col) => {
    const key = cellKey(row, col)

    if (interactionMode !== "build") return
    if (!dragState.tapEligible || placedBuildingsByCell.has(key) || pendingPlacements.has(key)) return

    pendingPlacements.add(key)

    try {
      const placement = await persistBuildingPlacement({ row, col, buildingKey: BUILDING_KEY })
      renderBuilding({
        row: placement.row,
        col: placement.col,
        buildingKey: placement.building_key,
      })
    } catch (error) {
      console.error("Failed to persist building placement", error)
    } finally {
      pendingPlacements.delete(key)
    }
  }

  const diamondMetricsForCell = (row, col, boardX, boardY) => {
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null

    const { x: tileX, y: tileY } = screenPositionFor(row, col)
    const tileLocalX = boardX - tileX
    const tileLocalY = boardY - tileY
    const normalizedX = Math.abs(tileLocalX) / (TILE_WIDTH / 2)
    const normalizedY = Math.abs(tileLocalY - TILE_HALF_HEIGHT / 2) / (TILE_HALF_HEIGHT / 2)

    return {
      col,
      normalizedX,
      normalizedY,
      row,
      score: normalizedX + normalizedY,
      tileLocalX,
      tileLocalY,
    }
  }

  const resolveCellFromBoardPoint = (boardX, boardY) => {
    const diagonalX = boardX / (TILE_WIDTH / 2)
    const diagonalY = boardY / (TILE_HALF_HEIGHT / 2)
    const colFloat = (diagonalX + diagonalY) / 2
    const rowFloat = (diagonalY - diagonalX) / 2
    const candidateRows = new Set([
      Math.floor(rowFloat),
      Math.ceil(rowFloat),
      Math.round(rowFloat),
    ])
    const candidateCols = new Set([
      Math.floor(colFloat),
      Math.ceil(colFloat),
      Math.round(colFloat),
    ])

    let bestMatch = null

    candidateRows.forEach((row) => {
      candidateCols.forEach((col) => {
        const metrics = diamondMetricsForCell(row, col, boardX, boardY)

        if (!metrics) return
        if (!bestMatch || metrics.score < bestMatch.score) {
          bestMatch = metrics
        }
      })
    })

    if (!bestMatch) return null

    if (bestMatch.score > 1.05) return null

    return { row: bestMatch.row, col: bestMatch.col }
  }

  const resolveCellFromPointerEvent = (event) => {
    const rect = app.canvas.getBoundingClientRect()
    const canvasX = ((event.clientX - rect.left) / rect.width) * app.screen.width
    const canvasY = ((event.clientY - rect.top) / rect.height) * app.screen.height

    globalPointerPoint.set(canvasX, canvasY)
    const boardPoint = boardContainer.toLocal(globalPointerPoint)

    return resolveCellFromBoardPoint(boardPoint.x, boardPoint.y)
  }

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const sprite = new Sprite(groundTexture)

      // Top tip of the diamond
      sprite.anchor.set(0.5, 0)
      sprite.row = row
      sprite.col = col

      // 2. Isometric Coordinate System Math
      const { x: screenX, y: screenY } = screenPositionFor(row, col)

      sprite.x = screenX
      sprite.y = screenY
      sprite.zIndex = col + row // Depth sorting

      boardContainer.addChild(sprite)
    }
  }

  buildingPlacements.forEach((placement) => {
    renderBuilding({
      row: placement.row,
      col: placement.col,
      buildingKey: placement.building_key,
    })
  })

  let hasInteracted = false

  const layoutCamera = ({ resetZoom = false } = {}) => {
    const boardBounds = boardContainer.getLocalBounds()
    const horizontalPadding = 24
    const verticalPadding = 24
    const initialZoomOut = 0.92
    const availableWidth = Math.max(1, app.screen.width - horizontalPadding * 2)
    const availableHeight = Math.max(1, app.screen.height - verticalPadding * 2)

    if (resetZoom) {
      const fitScale = Math.min(
        availableWidth / boardBounds.width,
        availableHeight / boardBounds.height,
        1,
      )
      camera.scale.set(fitScale * initialZoomOut)
    }

    const scaledBoardWidth = boardBounds.width * camera.scale.x
    const scaledBoardHeight = boardBounds.height * camera.scale.y

    camera.x = Math.max(
      horizontalPadding - boardBounds.x * camera.scale.x,
      (app.screen.width - scaledBoardWidth) / 2 - boardBounds.x * camera.scale.x,
    )

    camera.y = Math.max(
      verticalPadding - boardBounds.y * camera.scale.y,
      (app.screen.height - scaledBoardHeight) / 2 - boardBounds.y * camera.scale.y,
    )
  }

  // Start zoomed to fit so the initial view matches the "zoomed out a bit" state.
  layoutCamera({ resetZoom: true })

  const handleResize = () => {
    layoutCamera({ resetZoom: !hasInteracted })
  }

  app.renderer.on("resize", handleResize)

  const dragState = {
    dragThreshold: 3,
    hasMoved: false,
    isDragging: false,
    lastPointerX: 0,
    pointerIsDown: false,
    lastPointerY: 0,
    startPointerX: 0,
    startPointerY: 0,
    tapEligible: true,
  }

  app.canvas.style.cursor = "grab"
  app.canvas.style.touchAction = "none"
  app.canvas.style.userSelect = "none"
  app.canvas.style.webkitUserSelect = "none"

  const updateCursor = () => {
    if (interactionMode === "build" || interactionMode === "road") {
      app.canvas.style.cursor = "crosshair"
      return
    }

    app.canvas.style.cursor = dragState.isDragging ? "grabbing" : "grab"
  }

  const clearRoadGhosts = () => {
    roadState.ghostSprites.forEach(({ sprite }) => {
      boardContainer.removeChild(sprite)
      sprite.destroy()
    })
    roadState.ghostSprites.clear()
  }

  const handleRoadTilePaint = (row, col, buildingKey) => {
    const key = cellKey(row, col)
    if (placedBuildingsByCell.has(key)) return
    if (roadState.ghostSprites.has(key)) return

    const texture = texturesByKey[buildingKey]
    if (!texture) return

    const sprite = new Sprite(texture)
    const { x, y } = screenPositionFor(row, col)
    sprite.anchor.set(0.5, 0)
    sprite.x = x
    sprite.y = y
    sprite.zIndex = row + col + 0.5
    sprite.alpha = 0.5
    boardContainer.addChild(sprite)
    roadState.ghostSprites.set(key, { sprite, row, col, buildingKey })
  }

  const stopDragging = () => {
    dragState.pointerIsDown = false
    dragState.hasMoved = false
    dragState.isDragging = false
    updateCursor()
  }

  const handlePointerDown = (event) => {
    dragState.pointerIsDown = true
    dragState.hasMoved = false
    dragState.tapEligible = true
    dragState.lastPointerX = event.clientX
    dragState.lastPointerY = event.clientY
    dragState.startPointerX = event.clientX
    dragState.startPointerY = event.clientY
    dragState.isDragging = interactionMode === "pan"

    if (interactionMode === "road") {
      clearRoadGhosts()
      roadState.originCell = resolveCellFromPointerEvent(event)
      roadState.axis = null
    }

    updateCursor()
  }

  const handlePointerMove = (event) => {
    if (!dragState.pointerIsDown) return

    const currentX = event.clientX
    const currentY = event.clientY

    if (!dragState.hasMoved) {
      const totalDx = currentX - dragState.startPointerX
      const totalDy = currentY - dragState.startPointerY
      const distance = Math.hypot(totalDx, totalDy)

      if (distance < dragState.dragThreshold) return

      dragState.hasMoved = true
      dragState.tapEligible = false
      if (interactionMode === "pan") {
        hasInteracted = true
      }
    }

    if (interactionMode === "road") {
      const currentCell = resolveCellFromPointerEvent(event)
      if (!currentCell || !roadState.originCell) return

      if (!roadState.axis) {
        const totalDx = currentX - dragState.startPointerX
        const totalDy = currentY - dragState.startPointerY
        roadState.axis = Math.abs(totalDx) > Math.abs(totalDy) ? "col" : "row"
      }

      clearRoadGhosts()
      const { originCell, axis } = roadState
      const buildingKey = axis === "col" ? "road_col" : "road_row"

      if (axis === "col") {
        const row = originCell.row
        const colStart = Math.min(originCell.col, currentCell.col)
        const colEnd = Math.max(originCell.col, currentCell.col)
        for (let col = colStart; col <= colEnd; col++) {
          handleRoadTilePaint(row, col, buildingKey)
        }
      } else {
        const col = originCell.col
        const rowStart = Math.min(originCell.row, currentCell.row)
        const rowEnd = Math.max(originCell.row, currentCell.row)
        for (let row = rowStart; row <= rowEnd; row++) {
          handleRoadTilePaint(row, col, buildingKey)
        }
      }
      return
    }

    if (interactionMode !== "pan") {
      return
    }

    if (!dragState.hasMoved || !dragState.isDragging) return

    const dx = currentX - dragState.lastPointerX
    const dy = currentY - dragState.lastPointerY

    camera.x += dx
    camera.y += dy

    dragState.lastPointerX = currentX
    dragState.lastPointerY = currentY
  }

  const handlePointerUp = (event) => {
    if (interactionMode === "build" && dragState.pointerIsDown && dragState.tapEligible) {
      const cell = resolveCellFromPointerEvent(event)

      if (cell) {
        handleTileTap(cell.row, cell.col)
      }
    }

    if (interactionMode === "road" && roadState.ghostSprites.size > 0) {
      roadState.ghostSprites.forEach(({ sprite, row, col, buildingKey }) => {
        sprite.alpha = 1
        placedBuildingsByCell.set(cellKey(row, col), sprite)
        persistBuildingPlacement({ row, col, buildingKey }).catch((error) => {
          console.error("Failed to persist road placement", error)
        })
      })
      roadState.ghostSprites.clear()
      roadState.originCell = null
      roadState.axis = null
    }

    stopDragging()
  }

  const setInteractionMode = (mode) => {
    if (!["pan", "build", "road"].includes(mode)) return

    clearRoadGhosts()
    roadState.originCell = null
    roadState.axis = null
    interactionMode = mode
    stopDragging()
  }

  const preventBrowserDrag = (event) => event.preventDefault()

  app.canvas.addEventListener("dragstart", preventBrowserDrag)
  app.canvas.addEventListener("pointerdown", handlePointerDown)
  window.addEventListener("pointermove", handlePointerMove)
  window.addEventListener("pointerup", handlePointerUp)
  window.addEventListener("pointercancel", stopDragging)

  // Zooming

  app.canvas.addEventListener("wheel", (e) => {
    e.preventDefault()
    hasInteracted = true

    const zoomFactor = 1.1
    const scaleChange = e.deltaY < 0 ? 1 / zoomFactor : zoomFactor

    // Zoom relative to pointer
    const rect = app.canvas.getBoundingClientRect()
    const pointerX = e.clientX - rect.left
    const pointerY = e.clientY - rect.top

    // Convert pointer coords to camera local space
    const localX = (pointerX - camera.x) / camera.scale.x
    const localY = (pointerY - camera.y) / camera.scale.y

    // Apply zoom
    camera.scale.x /= scaleChange
    camera.scale.y /= scaleChange

    // Adjust camera position to keep pointer stationary
    camera.x = pointerX - localX * camera.scale.x
    camera.y = pointerY - localY * camera.scale.y
  }, { passive: false })

  app.cleanup = () => {
    app.renderer.off("resize", handleResize)
    app.canvas.removeEventListener("dragstart", preventBrowserDrag)
    app.canvas.removeEventListener("pointerdown", handlePointerDown)
    window.removeEventListener("pointermove", handlePointerMove)
    window.removeEventListener("pointerup", handlePointerUp)
    window.removeEventListener("pointercancel", stopDragging)
  }

  app.setInteractionMode = setInteractionMode

  return app
}
