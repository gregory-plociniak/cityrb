import { Controller } from "@hotwired/stimulus"
import { initPixiApp } from "pixi_app"

export default class extends Controller {
  static values = {
    tilesheetUrl: String
  }

  async connect() {
    this.app = await initPixiApp(this.element.id, this.tilesheetUrlValue)
  }

  disconnect() {
    this.app?.destroy(true)
    this.app = null
  }
}
