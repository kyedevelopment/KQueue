const Enmap = require("enmap");

class EssentialsPlugin {
  constructor(client) {
    this.client = client;
    this.version = "1.0";
    this.author = "kye";
  }
  async getInfo() {
    console.log(`[Essentials v${this.version}] Coded by ${this.author}`);
  }
}

module.exports = EssentialsPlugin;
