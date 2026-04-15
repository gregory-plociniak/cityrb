import { Application, Assets, Texture, Rectangle, Container, Sprite } from "pixi.js"

export async function initPixiApp(containerId, tilesheetUrl) {
  const containerElement = document.getElementById(containerId)
  const app = new Application()

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
    frame: new Rectangle(0, 128, 134, 128)
  })

  // 4. Orthographic Camera Implementation
  const camera = new Container()
  app.stage.addChild(camera)

  // 3. Board Generation & Depth Sorting
  const boardContainer = new Container()
  boardContainer.sortableChildren = true
  camera.addChild(boardContainer)

  const size = 10
  const W = 134
  const H = 128
  const h = 67 // Approximate half height

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const sprite = new Sprite(groundTexture)
      
      // Top tip of the diamond
      sprite.anchor.set(0.5, 0)
      
      // 2. Isometric Coordinate System Math
      const screenX = (col - row) * (W / 2)
      const screenY = (col + row) * (h / 2)
      
      sprite.x = screenX
      sprite.y = screenY
      sprite.zIndex = col + row // Depth sorting
      
      boardContainer.addChild(sprite)
    }
  }

  // Center the board visually within the canvas
  boardContainer.x = app.screen.width / 2
  boardContainer.y = 100

  const dragState = {
    dragThreshold: 3,
    hasMoved: false,
    isDragging: false,
    lastPointerX: 0,
    lastPointerY: 0,
    startPointerX: 0,
    startPointerY: 0,
  }

  app.canvas.style.cursor = "grab"
  app.canvas.style.touchAction = "none"
  app.canvas.style.userSelect = "none"
  app.canvas.style.webkitUserSelect = "none"

  const updateCursor = () => {
    app.canvas.style.cursor = dragState.isDragging ? "grabbing" : "grab"
  }

  const stopDragging = () => {
    dragState.hasMoved = false
    dragState.isDragging = false
    updateCursor()
  }

  const handlePointerDown = (event) => {
    dragState.hasMoved = false
    dragState.isDragging = true
    dragState.lastPointerX = event.clientX
    dragState.lastPointerY = event.clientY
    dragState.startPointerX = event.clientX
    dragState.startPointerY = event.clientY
    updateCursor()
  }

  const handlePointerMove = (event) => {
    if (!dragState.isDragging) return

    const currentX = event.clientX
    const currentY = event.clientY

    if (!dragState.hasMoved) {
      const totalDx = currentX - dragState.startPointerX
      const totalDy = currentY - dragState.startPointerY
      const distance = Math.hypot(totalDx, totalDy)

      if (distance < dragState.dragThreshold) return

      dragState.hasMoved = true
    }

    const dx = currentX - dragState.lastPointerX
    const dy = currentY - dragState.lastPointerY

    camera.x += dx
    camera.y += dy

    dragState.lastPointerX = currentX
    dragState.lastPointerY = currentY
  }

  const preventBrowserDrag = (event) => event.preventDefault()

  app.canvas.addEventListener("dragstart", preventBrowserDrag)
  app.canvas.addEventListener("pointerdown", handlePointerDown)
  window.addEventListener("pointermove", handlePointerMove)
  window.addEventListener("pointerup", stopDragging)
  window.addEventListener("pointercancel", stopDragging)

  // Zooming

  app.canvas.addEventListener("wheel", (e) => {
    e.preventDefault()
    
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
    app.canvas.removeEventListener("dragstart", preventBrowserDrag)
    app.canvas.removeEventListener("pointerdown", handlePointerDown)
    window.removeEventListener("pointermove", handlePointerMove)
    window.removeEventListener("pointerup", stopDragging)
    window.removeEventListener("pointercancel", stopDragging)
  }

  return app
}
