const { Event } = require('../../../structures');
const { DefaultEmbed, ErrorEmbed, SuccessEmbed } = require('../../../embeds');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = class extends Event {
  constructor(client) {
    super(client, {
      name: 'interactionCreate',
      enabled: true,
    });
  }

  async run(interaction) {
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

    if (interaction.customId === 'create_team') {
        const modal = new ModalBuilder()
          .setCustomId('create_team_modal')
          .setTitle('Create a Team');

        const teamNameInput = new TextInputBuilder()
          .setCustomId('team_name')
          .setLabel("What's your team name?")
          .setStyle(TextInputStyle.Short);

        const firstActionRow = new ActionRowBuilder().addComponents(teamNameInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
    } else if (interaction.customId === 'create_team_modal') {
        const teamName = interaction.fields.getTextInputValue('team_name');
        const userTeams = await db.get(`user_teams_${interaction.user.id}`) || [];
        const ownedTeams = await Promise.all(userTeams.map(async teamId => {
          const team = await db.get(`team_${teamId}`);
          return team && team.owner === interaction.user.id ? team : null;
        }));
        const ownedTeamsCount = ownedTeams.filter(Boolean).length;
      
        if (ownedTeamsCount >= 3) {
          await interaction.reply({ content: "You've reached the maximum limit of 3 owned teams.", ephemeral: true });
          return;
        }
      
        const teamId = Date.now().toString();
        const teamData = {
          id: teamId,
          name: teamName,
          owner: interaction.user.id,
          players: [interaction.user.id]
        };
        await db.set(`team_${teamId}`, teamData);
        await db.push(`user_teams_${interaction.user.id}`, teamId);
        await interaction.reply({ content: `Team "${teamName}" created successfully!`, ephemeral: true });
    } else if (interaction.customId === 'invite_player') {
        const userTeamIds = await db.get(`user_teams_${interaction.user.id}`) || [];
        const ownedTeams = [];
      
        for (const teamId of userTeamIds) {
          const teamData = await db.get(`team_${teamId}`);
          if (teamData && teamData.owner === interaction.user.id) {
            ownedTeams.push(teamData);
          }
        }
      
        if (ownedTeams.length === 0) {
          await interaction.reply({ content: "You don't own any teams.", ephemeral: true });
          return;
        }
      
        const modal = new ModalBuilder()
          .setCustomId('invite_player_modal')
          .setTitle('Invite a Player');
      
        const userIdInput = new TextInputBuilder()
          .setCustomId('user_id')
          .setLabel("Enter the user's ID")
          .setStyle(TextInputStyle.Short);
      
        const teamSelectInput = new TextInputBuilder()
          .setCustomId('team_name')
          .setLabel("Enter the team name")
          .setStyle(TextInputStyle.Short);
      
        const firstActionRow = new ActionRowBuilder().addComponents(userIdInput);
        const secondActionRow = new ActionRowBuilder().addComponents(teamSelectInput);
      
        modal.addComponents(firstActionRow, secondActionRow);
      
        await interaction.showModal(modal);
    } else if (interaction.customId === 'invite_player_modal') {
        const userId = interaction.fields.getTextInputValue('user_id');
          const teamName = interaction.fields.getTextInputValue('team_name');
          try {
            const player = await interaction.client.users.fetch(userId);
            const userTeams = await db.get(`user_teams_${interaction.user.id}`) || [];
            const userTeamData = await Promise.all(userTeams.map(teamId => db.get(`team_${teamId}`)));
            let teamData = userTeamData.find(team => team && team.name && team.name.toLowerCase() === teamName.toLowerCase());

            if (!teamData) {
              await interaction.reply({ content: "You don't own a team with that name.", ephemeral: true });
              return;
            }

            if (teamData.owner !== interaction.user.id) {
              await interaction.reply({ content: "You must be the owner of the team to send invites.", ephemeral: true });
              return;
            }
      
          if (player && teamData) {
            const inviteEmbed = new DefaultEmbed()
              .setTitle('Team Invitation')
              .setDescription(`You've been invited to join team "${teamData.name}" by ${interaction.user.tag}`);
      
            const inviteButtons = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(`accept_invite_${teamData.id}`)
                  .setLabel('Accept')
                  .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                  .setCustomId(`decline_invite_${teamData.id}`)
                  .setLabel('Decline')
                  .setStyle(ButtonStyle.Danger)
              );
            
            try {
              await player.send({ embeds: [inviteEmbed], components: [inviteButtons] });
              await interaction.reply({ content: `Invitation sent to ${player.tag} for team "${teamData.name}"`, ephemeral: true });
            } catch (dmError) {
              await interaction.reply({ content: `Unable to send invitation to ${player.tag}. They may have DMs closed or have blocked the bot.`, ephemeral: true });
            }
          } else if (!player) {
            await interaction.reply({ content: "Couldn't find a user with that ID.", ephemeral: true });
          } else {
            await interaction.reply({ content: "Couldn't find the specified team.", ephemeral: true });
          }
        } catch (error) {
          console.error('Error processing invitation:', error);
          await interaction.reply({ content: "An error occurred while trying to invite the player.", ephemeral: true });
        }
    } else if (interaction.customId === 'list_teams') {
        const userTeamIds = await db.get(`user_teams_${interaction.user.id}`) || [];
        if (userTeamIds.length === 0) {
          await interaction.reply({ content: "You're not in any teams.", ephemeral: true });
        } else {
          const teamsEmbed = new DefaultEmbed()
            .setTitle('Your Teams')
            .setDescription('Here are the teams you are part of:');
      
          for (const teamId of userTeamIds) {
            const teamData = await db.get(`team_${teamId}`);
            if (teamData) {
              const isOwner = teamData.owner === interaction.user.id;
              const playerList = teamData.players.map(id => `<@${id}>`).join(', ') || 'No players';
              teamsEmbed.addFields({
                name: `${teamData.name} (${isOwner ? 'Owner' : 'Player'})`,
                value: `Players: ${playerList}`
              });
            }
          }
      
          await interaction.reply({ embeds: [teamsEmbed], ephemeral: true });
        }
    } else if (interaction.customId === 'leave_team') {
        const userTeamIds = await db.get(`user_teams_${interaction.user.id}`) || [];
        const teamsAsPlayer = [];

        for (const teamId of userTeamIds) {
          const teamData = await db.get(`team_${teamId}`);
          if (teamData && teamData.owner !== interaction.user.id) {
            teamsAsPlayer.push(teamData);
          }
        }

        if (teamsAsPlayer.length === 0) {
          await interaction.reply({ content: "You're not a player in any teams.", ephemeral: true });
          return;
        }

        if (teamsAsPlayer.length === 1) {
          await leaveTeam(interaction.user.id, teamsAsPlayer[0].id);
          await interaction.reply({ content: `You've left the team ${teamsAsPlayer[0].name}.`, ephemeral: true });
        } else {
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('leave_team_select')
            .setPlaceholder('Select a team to leave')
            .addOptions(teamsAsPlayer.map(team => ({
              label: team.name,
              value: team.id
            })));

          const row = new ActionRowBuilder().addComponents(selectMenu);

          const embed = new DefaultEmbed()
            .setTitle('Leave Team')
            .setDescription('Select the team you want to leave:');

          await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }
    } else if (interaction.customId === 'leave_team_select') {
        const selectedTeamId = interaction.values[0];
        await leaveTeam(interaction.user.id, selectedTeamId);
    
        const teamData = await db.get(`team_${selectedTeamId}`);
        const teamName = teamData ? teamData.name : 'Unknown team';
    
        await interaction.update({ 
          content: `You've successfully left the team "${teamName}".`, 
          components: [], 
          embeds: [] 
        });
    }
  }

  async leaveTeam(userId, teamId) {
    const userTeams = await db.get(`user_teams_${userId}`) || [];
    const updatedUserTeams = userTeams.filter(id => id !== teamId);

    await db.set(`user_teams_${userId}`, updatedUserTeams);

    const teamData = await db.get(`team_${teamId}`);
    if (teamData) {
        teamData.players = teamData.players.filter(id => id !== userId);
        await db.set(`team_${teamId}`, teamData);
    
        if (teamData.players.length === 0) {
          await db.delete(`team_${teamId}`);
        }
    }
  }
};