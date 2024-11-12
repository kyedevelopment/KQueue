const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { DefaultEmbed, ErrorEmbed } = require('../../../embeds');
const { QuickDB } = require('quick.db');
const db = new QuickDB();
const { Event } = require('../../../structures/');

const PING_THRESHOLD = 6;
const PING_COOLDOWN = 1800000; // 30 min
let lastPingTime = 0;

module.exports = class extends Event {
    constructor(client) {
      super(client, {
        name: 'interactionCreate',
        enabled: true,
      });
    }
  
    async run(interaction) {
      if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
  
      const { customId, guild, user } = interaction;
  
      if (customId === 'join_queue' || customId === 'leave_queue' || customId.startsWith('join_queue_')) {
        await this.handleQueueInteraction(interaction);
      }
    }

    async handleQueueInteraction(interaction) {
        const { customId, guild, user } = interaction;
        await interaction.deferUpdate();
      
        const isBanned = await db.get(`queueBan_${guild.id}_${user.id}`);
        if (isBanned) {
          await interaction.followUp({ content: 'You are banned from joining the queue.', ephemeral: true });
          return;
        }
      
        const timeoutUntil = await db.get(`queueTimeout_${guild.id}_${user.id}`);
        if (timeoutUntil && timeoutUntil > Date.now()) {
          const remainingTime = Math.ceil((timeoutUntil - Date.now()) / 60000);
          await interaction.followUp({ content: `You are timed out from joining the queue. Try again in ${remainingTime} minutes.`, ephemeral: true });
          return;
        }
      
        const queue = await db.get(`queue_${guild.id}`) || [];
        let action, description;
      
        if (customId === 'join_queue') {
          const userTeams = await db.get(`user_teams_${user.id}`) || [];
          const ownedTeams = await Promise.all(userTeams.map(async teamId => {
            const team = await db.get(`team_${teamId}`);
            return team && team.owner === user.id ? team : null;
          })).then(teams => teams.filter(Boolean));
      
          if (ownedTeams.length > 0) {
            const embed = new DefaultEmbed()
              .setTitle('Join Queue')
              .setDescription('Select how you want to join the queue:');
      
            const row = new ActionRowBuilder();
            ownedTeams.forEach(team => {
              row.addComponents(
                new ButtonBuilder()
                  .setCustomId(`join_queue_team_${team.id}`)
                  .setLabel(`Join with ${team.name}`)
                  .setStyle(ButtonStyle.Primary)
              );
            });
            row.addComponents(
              new ButtonBuilder()
                .setCustomId('join_queue_solo')
                .setLabel('Join Solo')
                .setStyle(ButtonStyle.Secondary)
            );
      
            await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true });
            return;
          } else {
            action = await this.joinQueue(queue, interaction.user.id);
          }
       } else if (customId === 'leave_queue') {
          action = await this.leaveQueue(queue, user.id);
        } else if (customId.startsWith('join_queue_team_')) {
          const teamId = customId.split('_')[3];
          const team = await db.get(`team_${teamId}`);
          if (team) {
            action = await this.joinQueueWithTeam(queue, team);
          }
        } else if (customId === 'join_queue_solo') {
          action = await this.joinQueue(queue, user.id, interaction);
        }
      
        if (action) {
          await db.set(`queue_${guild.id}`, queue);
          await this.updateQueueEmbed(interaction, queue, action.description);
          await this.checkQueueAndPing(interaction, queue);
      
          if (queue.length >= 10) {
            const teams = queue.filter(item => typeof item === 'object' && item.players);
            const largeTeams = teams.filter(team => team.players.length >= 4);
            interaction.client.emit('queueFilled', guild, queue, largeTeams);
          }
        }
      }
      
      async joinQueue(queue, userId, interaction) {
        const testMode = await db.get(`queueTestMode_${interaction.guildId}`) || false;
        if (testMode || !queue.includes(userId)) {
          queue.push(userId);
          return { action: 'join', description: `<@${userId}> has joined the queue!` };
        }
        return null;
      }
      
      async joinQueueWithTeam(queue, team) {
        if (queue.length + team.players.length <= 10) {
          queue.push({ id: team.id, name: team.name, players: team.players });
          return { action: 'join', description: `Team ${team.name} has joined the queue!` };
        }
        return null;
      }

    async leaveQueue(queue, userId) {
        const index = queue.findIndex(item => {
          if (typeof item === 'string') {
            return item === userId;
          } else {
            return item.players.includes(userId);
          }
        });
      
        if (index > -1) {
          const removed = queue.splice(index, 1)[0];
          if (typeof removed === 'object') {
            return { action: 'leave', description: `Team ${removed.name} has left the queue!` };
          } else {
            return { action: 'leave', description: `<@${userId}> has left the queue!` };
          }
        }
        return null;
    }

    async updateQueueEmbed(interaction, queue, description) {
      const messageId = await db.get(`queueMessage_${interaction.guildId}`);
      const message = await interaction.channel.messages.fetch(messageId);
    
      const soloPlayers = [];
      const teams = [];
    
      queue.forEach(item => {
        if (typeof item === 'object') {
          teams.push(`Team ${item.name}: ${item.players.map(id => `<@${id}>`).join(', ')}`);
        } else {
          soloPlayers.push(`<@${item}>`);
        }
      });
    
      const playerList = [
        soloPlayers.join(', '),
        ...teams
      ].filter(Boolean).join('\n');
    
      const queueInfo = `${queue.reduce((acc, item) => acc + (typeof item === 'object' ? item.players.length : 1), 0)}/10\n\n${playerList || 'No players in queue'}`;
    
      const updatedEmbed = new DefaultEmbed()
        .setTitle('Burger TMS Queue')
        .setDescription(description)
        .addFields({ name: 'Queue', value: queueInfo });
    
      await message.edit({ embeds: [updatedEmbed] });
    }

    async deleteRecentMessages(channel, queueMessageId) {
      const messages = await channel.messages.fetch({ limit: 10 });
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const recentMessages = messages.filter(msg => msg.id !== queueMessageId && msg.createdTimestamp > twoWeeksAgo);
      
      if (recentMessages.size > 0) {
        await channel.bulkDelete(recentMessages);
      }
    }

      async checkQueueAndPing(interaction, queue) {
        const playerCount = queue.reduce((count, item) => count + (typeof item === 'string' ? 1 : item.players.length), 0);
        const playersNeeded = 10 - playerCount;
      
        if (playerCount >= PING_THRESHOLD) {
          const now = Date.now();
          if (now - lastPingTime > PING_COOLDOWN) {
            lastPingTime = now;
            const queueMessageId = await db.get(`queueMessage_${interaction.guildId}`);
            await this.deleteRecentMessages(interaction.channel, queueMessageId);
            await interaction.channel.send(`@here <@&1221353764045459507> Need \`${playersNeeded}\` more for queue!`);
          }
        }
      }

};


