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

  // Dragging / Panning
  app.stage.eventMode = 'static'
  app.stage.hitArea = new Rectangle(-100000, -100000, 200000, 200000)

  let isDragging = false
  let dragStart = { x: 0, y: 0 }
  let cameraStart = { x: 0, y: 0 }

  app.stage.on('pointerdown', (e) => {
    isDragging = true
    dragStart = { x: e.global.x, y: e.global.y }
    cameraStart = { x: camera.x, y: camera.y }
  })

  app.stage.on('pointerup', () => { isDragging = false })
  app.stage.on('pointerupoutside', () => { isDragging = false })

  app.stage.on('pointermove', (e) => {
    if (isDragging) {
      const dx = e.global.x - dragStart.x
      const dy = e.global.y - dragStart.y
      camera.x = cameraStart.x + dx
      camera.y = cameraStart.y + dy
    }
  })

  // Zooming
  app.canvas.addEventListener('wheel', (e) => {
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

  return app
}
