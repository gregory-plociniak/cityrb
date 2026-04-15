import { Application } from "pixi.js"

export async function initPixiApp(containerId) {
  const app = new Application()

  await app.init({
    background: "#1099bb",
    resizeTo: document.getElementById(containerId),
  })

  document.getElementById(containerId).appendChild(app.canvas)

  return app
}
