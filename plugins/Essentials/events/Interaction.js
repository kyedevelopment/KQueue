const config = require("../../../config");
const { ErrorEmbed } = require("../../../embeds");
const { Event } = require("../../../structures");
const { ChannelType } = require("discord.js");

module.exports = class extends Event {
  constructor(client) {
    super(client, {
      name: "interactionCreate",
      enabled: true,
    });
  }
  async run(interaction) {
    if (!interaction.isCommand()) return;
    if (interaction.channel.type === ChannelType.DM) return;
    const command = this.client.commands.get(interaction.commandName);
    interaction.user.pfp = interaction.user.displayAvatarURL({ dynamic: true });
    if (command) {
      try {
        await command.execute(interaction);
      } catch (error) {
        console.log(`An error ocurred: ${error.stack}`);
      }
    }
  }
};
