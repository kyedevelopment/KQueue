const Enmap = require("enmap");

class MatchmakingPlugin {
  constructor(client) {
    this.client = client;
    this.version = "1.0";
    this.author = "kye";
  }

  async getInfo() {
    console.log(`[Matchmaking v${this.version}] Coded by ${this.author}`);
  }
}

module.exports = MatchmakingPlugin;