const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Command } = require('../../../structures');
const { QuickDB } = require('quick.db');
const { ErrorEmbed, SuccessEmbed } = require('../../../embeds');

const db = new QuickDB();

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: 'clear-teams',
      enabled: true,
      data: new SlashCommandBuilder()
        .setName('clear-teams')
        .setDescription('Clear all team data from the database')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    });
  }

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const staffRoles = await db.get(`staffRoles_${interaction.guildId}`) || [];
    const userRoles = interaction.member.roles.cache;
    const hasStaffRole = staffRoles.some(staffRole => 
      userRoles.has(staffRole.id) && staffRole.permissions.includes('clear-teams')
    );

    if (!hasStaffRole && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.editReply({ embeds: [new ErrorEmbed('You do not have permission to use this command.')] });
    }

    const allUsers = await db.all();
    for (const user of allUsers) {
      if (user.id.startsWith('user_teams_')) {
        await db.delete(user.id);
      }
    }

    const allTeams = await db.all();
    for (const team of allTeams) {
      if (team.id.startsWith('team_')) {
        await db.delete(team.id);
      }
    }

    await interaction.editReply({ embeds: [new SuccessEmbed('All team data has been cleared from the database.')] });
  }
};