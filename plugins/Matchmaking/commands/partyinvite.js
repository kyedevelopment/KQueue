const { SlashCommandBuilder } = require('discord.js');
const { Command } = require('../../../structures');
const { DefaultEmbed } = require('../../../embeds');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: 'party-invite',
      enabled: true,
      data: new SlashCommandBuilder()
        .setName('party-invite')
        .setDescription('Invite a player to your party')
        .addUserOption(option =>
          option.setName('player')
            .setDescription('The player to invite')
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
    const player = interaction.options.getUser('player');
    const partyName = interaction.options.getString('party');
    const userTeams = await db.get(`user_teams_${interaction.user.id}`) || [];
    
    const ownedTeam = await Promise.all(userTeams.map(async teamId => {
      const team = await db.get(`team_${teamId}`);
      return team && team.name.toLowerCase() === partyName.toLowerCase() && team.owner === interaction.user.id ? team : null;
    })).then(teams => teams.find(Boolean));

    if (!ownedTeam) {
      return interaction.reply({ content: "You don't own a party with that name.", ephemeral: true });
    }

    if (ownedTeam.players.length >= 5) {
      return interaction.reply({ content: "This party has reached the maximum number of players (5).", ephemeral: true });
    }

    const inviteEmbed = new DefaultEmbed()
      .setTitle('Party Invitation')
      .setDescription(`You've been invited to join party "${ownedTeam.name}" by ${interaction.user.tag}`);

    const inviteButtons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`accept_invite_${ownedTeam.id}`)
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`decline_invite_${ownedTeam.id}`)
          .setLabel('Decline')
          .setStyle(ButtonStyle.Danger)
      );

    try {
      await player.send({ embeds: [inviteEmbed], components: [inviteButtons] });
      await interaction.reply({ content: `Invitation sent to ${player.tag} for party "${ownedTeam.name}"`, ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: `Unable to send invitation to ${player.tag}. They may have DMs closed or have blocked the bot.`, ephemeral: true });
    }
  }
};