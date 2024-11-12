class Cron {
  constructor(client, options) {
    this.client = client;
    this.format = options.format;
    this.enabled = options.enabled;
  }
}

module.exports = Cron;
