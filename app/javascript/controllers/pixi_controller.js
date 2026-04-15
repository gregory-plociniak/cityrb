import { Controller } from "@hotwired/stimulus"
import { initPixiApp } from "pixi_app"

export default class extends Controller {
  static targets = ["canvas", "buildingButton", "modeLabel"]

  static values = {
    buildingPlacements: Array,
    tilesheetUrl: String
  }

  async connect() {
    this.mode = "pan"
    this.syncModeUi()

    const app = await initPixiApp(this.canvasTarget.id, {
      buildingPlacements: this.buildingPlacementsValue,
      tilesheetUrl: this.tilesheetUrlValue
    })

    if (!this.element.isConnected) {
      app?.cleanup?.()
      app?.destroy(true)
      return
    }

    this.app = app
    this.app.setInteractionMode?.(this.mode)
  }

  toggleBuildMode() {
    this.setMode(this.mode === "build" ? "pan" : "build")
  }

  disconnect() {
    this.app?.cleanup?.()
    this.app?.destroy(true)
    this.app = null
  }

  setMode(mode) {
    if (!["pan", "build"].includes(mode)) return

    this.mode = mode
    this.syncModeUi()
    this.app?.setInteractionMode?.(mode)
  }

  syncModeUi() {
    const buildModeActive = this.mode === "build"

    this.element.dataset.mode = this.mode
    this.buildingButtonTarget.classList.toggle("is-active", buildModeActive)
    this.buildingButtonTarget.setAttribute("aria-pressed", String(buildModeActive))
    this.modeLabelTarget.textContent = `Mode: ${buildModeActive ? "Build" : "Pan"}`
  }
}
