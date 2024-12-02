const { SlashCommandBuilder } = require('discord.js');
const { Command } = require('../../../structures');
const { DefaultEmbed } = require('../../../embeds');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: 'party-list',
      enabled: true,
      data: new SlashCommandBuilder()
        .setName('party-list')
        .setDescription('List all parties you are in'),
    });
  }

  async execute(interaction) {
    const userTeamIds = await db.get(`user_teams_${interaction.user.id}`) || [];
    
    if (userTeamIds.length === 0) {
      return interaction.reply({ content: "You're not in any parties.", ephemeral: true });
    }

    const teamsEmbed = new DefaultEmbed()
      .setTitle('Your Parties')
      .setDescription('Here are the parties you are part of:');

    for (const teamId of userTeamIds) {
      const teamData = await db.get(`team_${teamId}`);
      if (teamData) {
        const isOwner = teamData.owner === interaction.user.id;
        const playerList = teamData.players.map(id => `<@${id}>`).join(', ') || 'No players';

        teamsEmbed.addFields({
          name: `${teamData.name} (${isOwner ? 'Owner' : 'Member'})`,
          value: `Players: ${playerList}`
        });
      }
    }

    await interaction.reply({ embeds: [teamsEmbed], ephemeral: true });
  }
};