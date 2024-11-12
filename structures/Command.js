class Command {
  constructor(client, config) {
    this.client = client;
    this.name = config.name;
    this.enabled = config.enabled;
    this.syntax = config.syntax || "No syntax found.";
    this.data = config.data;
  }
}

module.exports = Command;
