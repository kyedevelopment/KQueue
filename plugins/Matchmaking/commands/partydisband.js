const { SlashCommandBuilder } = require('discord.js');
const { Command } = require('../../../structures');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: 'party-disband',
      enabled: true,
      data: new SlashCommandBuilder()
        .setName('party-disband')
        .setDescription('Disband a party you own')
        .addStringOption(option =>
          option.setName('party')
            .setDescription('The name of the party to disband')
            .setRequired(true)
        ),
    });
  }

  async execute(interaction) {
    const partyName = interaction.options.getString('party');
    const userTeams = await db.get(`user_teams_${interaction.user.id}`) || [];
    
    const teamToDisband = await Promise.all(userTeams.map(async teamId => {
      const team = await db.get(`team_${teamId}`);
      return team && team.name.toLowerCase() === partyName.toLowerCase() ? team : null;
    })).then(teams => teams.find(Boolean));

    if (!teamToDisband) {
      return interaction.reply({ content: "You don't own a party with that name.", ephemeral: true });
    }

    if (teamToDisband.owner !== interaction.user.id) {
      return interaction.reply({ content: "You can only disband parties you own.", ephemeral: true });
    }

    for (const playerId of teamToDisband.players) {
      const playerTeams = await db.get(`user_teams_${playerId}`) || [];
      const updatedPlayerTeams = playerTeams.filter(id => id !== teamToDisband.id);
      await db.set(`user_teams_${playerId}`, updatedPlayerTeams);
    }

    await db.delete(`team_${teamToDisband.id}`);

    await interaction.reply({ content: `The party "${teamToDisband.name}" has been successfully disbanded.`, ephemeral: true });
  }
};