class Event {
  constructor(client, config) {
    this.client = client;
    this.name = config.name;
    this.enabled = config.enabled;
  }
}

module.exports = Event;
