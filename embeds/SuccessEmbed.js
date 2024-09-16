const { EmbedBuilder } = require("discord.js");

class SuccessEmbed extends EmbedBuilder {
  constructor(data) {
    super(data);
    this.data.color = 0x32cd32;
    this.data.description = `✅ ${data.description}`;
  }
}

module.exports = SuccessEmbed;
