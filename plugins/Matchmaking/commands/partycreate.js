const { SlashCommandBuilder } = require('discord.js');
const { Command } = require('../../../structures');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: 'party-create',
      enabled: true,
      data: new SlashCommandBuilder()
        .setName('party-create')
        .setDescription('Create a new party')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('The name of the party')
            .setRequired(true)
        ),
    });
  }

  async execute(interaction) {
    const partyName = interaction.options.getString('name');
    const userTeams = await db.get(`user_teams_${interaction.user.id}`) || [];
    
    const ownedTeams = await Promise.all(userTeams.map(async teamId => {
      const team = await db.get(`team_${teamId}`);
      return team && team.owner === interaction.user.id ? team : null;
    }));
    
    const ownedTeamsCount = ownedTeams.filter(Boolean).length;

    if (ownedTeamsCount >= 3) {
      return interaction.reply({ content: "You've reached the maximum limit of 3 owned parties.", ephemeral: true });
    }

    const teamId = Date.now().toString();
    const teamData = {
      id: teamId,
      name: partyName,
      owner: interaction.user.id,
      players: [interaction.user.id]
    };

    await db.set(`team_${teamId}`, teamData);
    await db.push(`user_teams_${interaction.user.id}`, teamId);

    await interaction.reply({ content: `Party "${partyName}" created successfully!`, ephemeral: true });
  }
};