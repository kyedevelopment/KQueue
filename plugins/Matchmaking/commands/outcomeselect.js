const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Command } = require('../../../structures');
const { SuccessEmbed, ErrorEmbed } = require('../../../embeds');
const { QuickDB } = require('quick.db');
const db = new QuickDB();
const MMRSystem = require('../mmr');

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: 'outcomeselect',
      enabled: true,
      data: new SlashCommandBuilder()
        .setName('outcomeselect')
        .setDescription('Select the winner of a match')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(option =>
          option.setName('winner')
            .setDescription('The winning team')
            .setRequired(true)
            .addChoices(
              { name: 'Team 1', value: 'Team 1' },
              { name: 'Team 2', value: 'Team 2' }
            ))
        .addIntegerOption(option =>
          option.setName('queue_number')
            .setDescription('The queue number of the match')
            .setRequired(true)),
    });
  }

  async execute(interaction) {
  }
};