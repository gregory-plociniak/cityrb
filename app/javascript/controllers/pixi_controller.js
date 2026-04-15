import { Controller } from "@hotwired/stimulus"
import { initPixiApp } from "pixi_app"

export default class extends Controller {
  static targets = ["canvas", "buildingButton", "roadButton", "modeLabel"]

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

  toggleRoadMode() {
    this.setMode(this.mode === "road" ? "pan" : "road")
  }

  async reset() {
    await fetch("/building_placements", { method: "DELETE", headers: { "X-CSRF-Token": document.querySelector("meta[name=csrf-token]")?.content } })
    window.location.reload()
  }

  disconnect() {
    this.app?.cleanup?.()
    this.app?.destroy(true)
    this.app = null
  }

  setMode(mode) {
    if (!["pan", "build", "road"].includes(mode)) return

    this.mode = mode
    this.syncModeUi()
    this.app?.setInteractionMode?.(mode)
  }

  syncModeUi() {
    const buildModeActive = this.mode === "build"
    const roadModeActive = this.mode === "road"

    this.element.dataset.mode = this.mode
    this.buildingButtonTarget.classList.toggle("is-active", buildModeActive)
    this.buildingButtonTarget.setAttribute("aria-pressed", String(buildModeActive))
    this.roadButtonTarget.classList.toggle("is-active", roadModeActive)
    this.roadButtonTarget.setAttribute("aria-pressed", String(roadModeActive))

    let label = "Pan"
    if (buildModeActive) label = "Build"
    if (roadModeActive) label = "Road"
    this.modeLabelTarget.textContent = `Mode: ${label}`
  }
}
