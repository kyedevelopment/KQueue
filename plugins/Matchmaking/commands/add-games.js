const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Command } = require('../../../structures');
const { SuccessEmbed, ErrorEmbed } = require('../../../embeds');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: 'add-games',
      enabled: true,
      data: new SlashCommandBuilder()
        .setName('add-games')
        .setDescription('ADMIN: Add games played to a player')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addUserOption(option => 
          option.setName('player')
            .setDescription('The player to add games to')
            .setRequired(true))
        .addIntegerOption(option => 
          option.setName('games')
            .setDescription('The number of games to add')
            .setRequired(true)),
    });
  }

  async execute(interaction) {
    const player = interaction.options.getUser('player');
    const games = interaction.options.getInteger('games');

    try {
      let playerData = await db.get(`player_${interaction.guildId}_${player.id}`);
      if (!playerData) {
        playerData = { mmr: 1000, wins: 0, losses: 0, gamesPlayed: 0 };
      }

      playerData.gamesPlayed += games;
      await db.set(`player_${interaction.guildId}_${player.id}`, playerData);

      const successEmbed = new SuccessEmbed({
        description: `Successfully added ${games} games to ${player.username}. Their total games played is now ${playerData.gamesPlayed}.`
      });

      await interaction.reply({ embeds: [successEmbed] });
    } catch (error) {
      console.error('Error adding games:', error);
      await interaction.reply({ embeds: [new ErrorEmbed({ description: 'An error occurred while adding games.' })], ephemeral: true });
    }
  }
};