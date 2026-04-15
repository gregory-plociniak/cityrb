import { Controller } from "@hotwired/stimulus"
import { initPixiApp } from "pixi_app"

export default class extends Controller {
  async connect() {
    this.app = await initPixiApp(this.element.id)
  }

  disconnect() {
    this.app?.destroy(true)
    this.app = null
  }
}
