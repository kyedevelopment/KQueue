const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Command } = require('../../../structures');
const { SuccessEmbed, ErrorEmbed } = require('../../../embeds');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: 'add-mmr',
      enabled: true,
      data: new SlashCommandBuilder()
        .setName('add-mmr')
        .setDescription('ADMIN: Add MMR to a player, use a negative number to subtract MMR')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addUserOption(option => 
          option.setName('player')
            .setDescription('The player to add MMR to')
            .setRequired(true))
        .addIntegerOption(option => 
          option.setName('amount')
            .setDescription('The amount of MMR to add')
            .setRequired(true)),
    });
  }

  async execute(interaction) {
    const player = interaction.options.getUser('player');
    const amount = interaction.options.getInteger('amount');

    try {
      const playerData = await db.get(`player_${interaction.guildId}_${player.id}`);
      if (!playerData) {
        return interaction.reply({ embeds: [new ErrorEmbed({ description: 'This player has no MMR data.' })], ephemeral: true });
      }

      playerData.mmr += amount;
      await db.set(`player_${interaction.guildId}_${player.id}`, playerData);

      const successEmbed = new SuccessEmbed({
        description: `Successfully added ${amount} MMR to ${player.username}. Their new MMR is ${playerData.mmr}.`
      });

      await interaction.reply({ embeds: [successEmbed] });
    } catch (error) {
      console.error('Error adding MMR:', error);
      await interaction.reply({ embeds: [new ErrorEmbed({ description: 'An error occurred while adding MMR.' })], ephemeral: true });
    }
  }
};