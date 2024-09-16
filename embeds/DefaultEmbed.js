const { EmbedBuilder } = require("discord.js");
const { color } = require("../config.js");

class DefaultEmbed extends EmbedBuilder {
  constructor(data) {
    super(data);
    this.data.color = 0x800080;
  }
}

module.exports = DefaultEmbed;
