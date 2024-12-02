const { SlashCommandBuilder } = require('discord.js');
const { Command } = require('../../../structures');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: 'party-kick',
      enabled: true,
      data: new SlashCommandBuilder()
        .setName('party-kick')
        .setDescription('Kick a member from your party')
        .addUserOption(option =>
          option.setName('player')
            .setDescription('The player to kick')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('party')
            .setDescription('The name of your party')
            .setRequired(true)
        ),
    });
  }

  async execute(interaction) {
    const playerToKick = interaction.options.getUser('player');
    const partyName = interaction.options.getString('party');
    const userTeams = await db.get(`user_teams_${interaction.user.id}`) || [];
    
    const ownedTeam = await Promise.all(userTeams.map(async teamId => {
      const team = await db.get(`team_${teamId}`);
      return team && team.name.toLowerCase() === partyName.toLowerCase() && team.owner === interaction.user.id ? team : null;
    })).then(teams => teams.find(Boolean));

    if (!ownedTeam) {
      return interaction.reply({ content: "You don't own a party with that name.", ephemeral: true });
    }

    if (!ownedTeam.players.includes(playerToKick.id)) {
      return interaction.reply({ content: "This player is not in your party.", ephemeral: true });
    }

    ownedTeam.players = ownedTeam.players.filter(id => id !== playerToKick.id);
    await db.set(`team_${ownedTeam.id}`, ownedTeam);

    const playerTeams = await db.get(`user_teams_${playerToKick.id}`) || [];
    const updatedPlayerTeams = playerTeams.filter(id => id !== ownedTeam.id);
    await db.set(`user_teams_${playerToKick.id}`, updatedPlayerTeams);

    await interaction.reply({ content: `${playerToKick.tag} has been kicked from the party "${ownedTeam.name}".`, ephemeral: true });
  }
};