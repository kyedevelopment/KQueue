const { Event } = require('../../../structures');
const { QuickDB } = require('quick.db');
const db = new QuickDB();
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = class extends Event {
  constructor(client) {
    super(client, {
      name: 'interactionCreate',
      enabled: true,
    });
  }

  async run(interaction) {
    if (!interaction.isButton()) return;

    const disabledButtons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('accept_invite')
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('decline_invite')
          .setLabel('Decline')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true)
      );

      if (interaction.customId.startsWith('accept_invite')) {
        const teamId = interaction.customId.split('_')[2];
        const teamData = await db.get(`team_${teamId}`);
      
        if (!teamData) {
          await interaction.update({ content: 'The team you were invited to no longer exists.', components: [disabledButtons] });
          return;
        }
      
        if (teamData.players.length >= 5) {
          await interaction.update({ content: 'This team has reached the maximum number of players (5).', components: [disabledButtons] });
          return;
        }
      
        teamData.players.push(interaction.user.id);
        await db.set(`team_${teamId}`, teamData);
        await db.push(`user_teams_${interaction.user.id}`, teamId);
      
        await interaction.update({ content: `You've joined the team "${teamData.name}"!`, components: [disabledButtons] });
      }

    if (interaction.customId === 'decline_invite') {
      await interaction.update({ content: "You've declined the team invitation.", components: [disabledButtons] });
    }
  }
};