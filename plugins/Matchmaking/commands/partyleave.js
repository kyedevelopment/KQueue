const { SlashCommandBuilder } = require('discord.js');
const { Command } = require('../../../structures');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: 'party-leave',
      enabled: true,
      data: new SlashCommandBuilder()
        .setName('party-leave')
        .setDescription('Leave a party')
        .addStringOption(option =>
          option.setName('party')
            .setDescription('The name of the party to leave')
            .setRequired(true)
        ),
    });
  }

  async execute(interaction) {
    const partyName = interaction.options.getString('party');
    const userTeams = await db.get(`user_teams_${interaction.user.id}`) || [];
    
    const teamToLeave = await Promise.all(userTeams.map(async teamId => {
      const team = await db.get(`team_${teamId}`);
      return team && team.name.toLowerCase() === partyName.toLowerCase() ? team : null;
    })).then(teams => teams.find(Boolean));

    if (!teamToLeave) {
      return interaction.reply({ content: "You're not in a party with that name.", ephemeral: true });
    }

    if (teamToLeave.owner === interaction.user.id) {
      return interaction.reply({ content: "You can't leave a party you own. Use the disband command instead.", ephemeral: true });
    }

    teamToLeave.players = teamToLeave.players.filter(id => id !== interaction.user.id);
    await db.set(`team_${teamToLeave.id}`, teamToLeave);

    const updatedUserTeams = userTeams.filter(id => id !== teamToLeave.id);
    await db.set(`user_teams_${interaction.user.id}`, updatedUserTeams);

    await interaction.reply({ content: `You have successfully left the party "${teamToLeave.name}".`, ephemeral: true });
  }
};