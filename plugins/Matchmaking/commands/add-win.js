const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Command } = require('../../../structures');
const { SuccessEmbed, ErrorEmbed } = require('../../../embeds');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: 'add-win',
      enabled: true,
      data: new SlashCommandBuilder()
        .setName('add-win')
        .setDescription('ADMIN: Add a win to a player')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addUserOption(option => 
          option.setName('player')
            .setDescription('The player to add a win to')
            .setRequired(true))
        .addIntegerOption(option => 
          option.setName('wins')
            .setDescription('The number of wins to add')
            .setRequired(true)),
    });
  }

  async execute(interaction) {
    const player = interaction.options.getUser('player');
    const wins = interaction.options.getInteger('wins');

    try {
      let playerData = await db.get(`player_${interaction.guildId}_${player.id}`);
      if (!playerData) {
        playerData = { mmr: 1000, wins: 0, losses: 0, gamesPlayed: 0 };
      }

      playerData.wins += wins;
      playerData.gamesPlayed += wins;
      await db.set(`player_${interaction.guildId}_${player.id}`, playerData);

      const successEmbed = new SuccessEmbed({
        description: `Successfully added ${wins} win(s) to ${player.username}. Their new record is ${playerData.wins}W - ${playerData.losses}L.`
      });

      await interaction.reply({ embeds: [successEmbed] });
    } catch (error) {
      console.error('Error adding win:', error);
      await interaction.reply({ embeds: [new ErrorEmbed({ description: 'An error occurred while adding win(s).' })], ephemeral: true });
    }
  }
};