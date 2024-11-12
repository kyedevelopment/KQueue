const fs = require("fs");
const Cron = require("node-cron");

class PluginManager {
  constructor(client) {
    this.client = client;
  }

  async load() {
    const plugins = await fs.readdirSync("./plugins/");
    if (!plugins.length)
      throw Error("Sorry, no plugins found in plugins/ directory.");

    for (const plugin of plugins) {
      const commandsPath = `./plugins/${plugin}/commands`;
      const eventsPath = `./plugins/${plugin}/events`;
      const cronsPath = `./plugins/${plugin}/crons`;

      await this.assignPlugin(plugin);
      await this.loadCommands(commandsPath);
      await this.loadEvents(eventsPath);
      await this.loadCrons(cronsPath);
    }
  }

  async assignPlugin(pluginName) {
    const Plugin = require(`../plugins/${pluginName}/${pluginName}`);
    this.client.plugins[pluginName.toLowerCase()] = new Plugin(this.client);
    console.log(`[Plugins] ${pluginName} has been loaded!\n`);
  }

  async loadCommands(path) {
    let files;
    try {
      files = await fs.readdirSync(path);
    } catch (error) {
      return;
    }
    const filteredFiles = files.filter((file) => file.endsWith(".js"));
    for (const file of filteredFiles) {
      const command = new (require(`../${path}/${file}`))(this.client);
      if (!command.enabled) continue;
      this.client.commands.set(command.name, command);
    }
  }

  async loadEvents(path) {
    let files;
    try {
      files = await fs.readdirSync(path);
    } catch (error) {
      return;
    }
    const filteredFiles = files.filter((file) => file.endsWith(".js"));
    for (const file of filteredFiles) {
      const event = new (require(`../${path}/${file}`))(this.client);
      if (!event.enabled) continue;
      this.client.on(event.name, (...args) => event.run(...args));
    }
  }
  async loadCrons(path) {
    let files;
    try {
      files = await fs.readdirSync(path);
    } catch (error) {
      return;
    }
    const filteredFiles = files.filter((file) => file.endsWith(".js"));
    for (const file of filteredFiles) {
      const cron = new (require(`../${path}/${file}`))(this.client);
      if (!cron.enabled) return;
      const job = await Cron.schedule(
        cron.format,
        () => cron.execute(),
        null,
        true
      );
      job.start();
    }
  }
}

module.exports = PluginManager;
