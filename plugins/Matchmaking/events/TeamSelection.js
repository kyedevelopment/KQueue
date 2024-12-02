const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Event } = require('../../../structures');
const { DefaultEmbed } = require('../../../embeds');
const MMRSystem = require('../mmr');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = class extends Event {
  constructor(client) {
    super(client, {
      name: 'teamSelection',
      enabled: true,
    });
  }

  async run(guild, captains, allPlayers, textChannel) {
    const testMode = await db.get(`queueTestMode_${guild.id}`) || false;
    let availablePlayers = testMode ? Array(8).fill(allPlayers[0]) : allPlayers.filter(player => !captains.includes(player));
    let team1 = [captains[0]];
    let team2 = [captains[1]];
    let currentCaptain = 0;
    let pickCount = [1, 2, 2, 2, 1];
    let timer = null;
    let timeLeft = 30;

    const updateEmbed = async () => {
      const playerButtons = [];
      const playerList = availablePlayers.map((id, index) => `${index + 1}. <@${id}>`);

      if (availablePlayers.length > 0) {
        const row = new ActionRowBuilder();
        for (let i = 0; i < Math.min(availablePlayers.length, 5); i++) {
          const player = await guild.members.fetch(availablePlayers[i]);
          const displayName = player.displayName || player.nickname || player.user.username;
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`pick_${i + 1}`)
              .setLabel(`${i + 1}. ${displayName}`)
              .setStyle(ButtonStyle.Primary)
          );
        }
        playerButtons.push(row);
    
        if (availablePlayers.length > 5) {
          const row2 = new ActionRowBuilder();
          for (let i = 5; i < availablePlayers.length; i++) {
            const player = await guild.members.fetch(availablePlayers[i]);
            const displayName = player.displayName || player.nickname || player.user.username;
            row2.addComponents(
              new ButtonBuilder()
                .setCustomId(`pick_${i + 1}`)
                .setLabel(`${i + 1}. ${displayName}`)
                .setStyle(ButtonStyle.Primary)
            );
          }
          playerButtons.push(row2);
        }
      }


      const teamSelectionEmbed = new DefaultEmbed()
        .setTitle("Team Selection")
        .addFields(
          { name: "Team 1 (Attack)", value: team1.map(id => `<@${id}>`).join('\n') },
          { name: "Team 2 (Defense)", value: team2.map(id => `<@${id}>`).join('\n') },
          { name: "Available Players", value: playerList.length > 0 ? playerList.join('\n') : "No players available" }
        )
        .setDescription(`Captain <@${captains[currentCaptain]}>, pick ${pickCount[0]} player(s).`)
        .setFooter({ text: `Time left: ${timeLeft} seconds` });

        if (team1.length + team2.length === 10) {
          const potentialChanges = await MMRSystem.calculatePotentialMMRChange(guild.id, team1, team2);
          const team1AverageGain = Math.round(potentialChanges.team1.reduce((sum, change) => sum + change.potentialGain, 0) / team1.length);
          const team2AverageGain = Math.round(potentialChanges.team2.reduce((sum, change) => sum + change.potentialGain, 0) / team2.length);

          teamSelectionEmbed.setFields(
            { name: `Team 1 (Attack) - (+${team1AverageGain})`, value: team1.map(id => `<@${id}>`).join(', ') },
            { name: `Team 2 (Defense) - (+${team2AverageGain})`, value: team2.map(id => `<@${id}>`).join(', ') }
          )
          .setFooter({ text: `discord.gg/` })
          .setDescription(availablePlayers.length > 0 
            ? `Captain <@${captains[currentCaptain]}>, pick ${pickCount[0]} player(s).`
            : "Team selection complete.");
        }

        return { embeds: [teamSelectionEmbed], components: playerButtons };
    };


    const message = await textChannel.send(await updateEmbed());
    const collector = message.createMessageComponentCollector({ time: 300000 });
    timer = setInterval(async () => {
      timeLeft -= 5;
      if (timeLeft <= 0) {
        const firstPlayer = availablePlayers[0];
        if (currentCaptain === 0) {
          team1.push(firstPlayer);
        } else {
          team2.push(firstPlayer);
        }
        availablePlayers.splice(0, 1);
        pickCount[0]--;
        if (pickCount[0] === 0) {
          pickCount.shift();
          currentCaptain = 1 - currentCaptain;
        }
        timeLeft = 30;
        await message.edit(await updateEmbed());
      } else {
        await message.edit(await updateEmbed());
      }
    }, 5000);

    collector.on('collect', async (interaction) => {
      await interaction.deferUpdate();

      if (interaction.user.id !== captains[currentCaptain]) {
        await interaction.reply({ content: "It's not your turn to pick!", ephemeral: true });
        return;
      }

      const pickIndex = parseInt(interaction.customId.split('_')[1]) - 1;
      const pickedPlayer = availablePlayers[pickIndex];

      if (currentCaptain === 0) {
        team1.push(pickedPlayer);
      } else {
        team2.push(pickedPlayer);
      }

      availablePlayers.splice(pickIndex, 1);
      pickCount[0]--;

      if (pickCount[0] === 0) {
        pickCount.shift();
        currentCaptain = 1 - currentCaptain;
      }

      if (timer) { 
        clearInterval(timer); 
        timer = null;
      }
      timeLeft = 30;
      timer = setInterval(async () => {
        timeLeft -= 5;
        if (timeLeft <= 0) {
          clearInterval(timer);

          const firstPlayer = availablePlayers[0];
          if (currentCaptain === 0) {
            team1.push(firstPlayer);
          } else {
            team2.push(firstPlayer);
          }
          availablePlayers.splice(0, 1);
          pickCount[0]--;
          if (pickCount[0] === 0) {
            pickCount.shift();
            currentCaptain = 1 - currentCaptain;
          }
          timeLeft = 30;
          await message.edit(await updateEmbed());
        } else {
          await message.edit(await updateEmbed());
        }
      }, 5000);
      await message.edit(await updateEmbed());

      if (team1.length + team2.length === 10) {
        clearInterval(timer);
        collector.stop();
      } 
    });

    collector.on('end', async () => {
      if (team1.length + team2.length === 10) {
        this.client.emit('mapSelection', guild, team1, team2, textChannel);
      } else {
        console.log("Collector ended before teams were full.");
      }
    });
  }
};