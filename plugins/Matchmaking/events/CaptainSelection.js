const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Event } = require('../../../structures');
const { DefaultEmbed } = require('../../../embeds');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = class extends Event {
  constructor(client) {
    super(client, {
      name: 'captainSelection',
      enabled: true,
    });
  }

  async run(guild, queue, textChannel, voiceChannel) {
    const testMode = await db.get('queueTestMode') || false;
    const checkAllPlayersPresent = () => {
      const voiceMembers = voiceChannel.members.map(member => member.id);
      return queue.every(playerId => voiceMembers.includes(playerId));
    };

    if (!checkAllPlayersPresent()) {
      const waitMessage = await textChannel.send('Waiting for all players to join the voice channel. 3 minutes remaining.');
      
      const startTime = Date.now();
      const checkInterval = setInterval(async () => {
        if (checkAllPlayersPresent()) {
          clearInterval(checkInterval);
          await waitMessage.delete();
          await this.startSelectionProcess(guild, queue, textChannel, voiceChannel);
        } else if (Date.now() - startTime > 180000) { // 3 minutes
          clearInterval(checkInterval);
          await textChannel.send('Not all players joined within 3 minutes. The game has been cancelled.');
          setTimeout(async () => {
            await textChannel.delete();
            await voiceChannel.delete();
          }, 10000);
        } else {
          const timeLeft = Math.round((180000 - (Date.now() - startTime)) / 1000);
          await waitMessage.edit(`${timeLeft} seconds remaining.`);
        }
      }, 10000); // Check every 10 seconds
    } else {
      await this.startSelectionProcess(guild, queue, textChannel, voiceChannel);
    }
  }

  async startSelectionProcess(guild, queue, textChannel, voiceChannel, largeTeams) {
    if (largeTeams && largeTeams.length >= 2) {
      const captains = largeTeams.slice(0, 2).map(team => team.owner);
      this.client.emit('teamSelection', guild, captains, queue, textChannel);
    } else if (largeTeams && largeTeams.length === 1) {
      const firstCaptain = largeTeams[0].owner;
      const secondCaptain = await this.selectSecondCaptain(guild, queue, firstCaptain);
      this.client.emit('teamSelection', guild, [firstCaptain, secondCaptain], queue, textChannel);
    } else {
      const selectionMethod = await this.voteForSelectionMethod(textChannel, queue);

      switch (selectionMethod) {
        case 'balanced':
          await this.selectBalancedCaptains(guild, queue, textChannel);
          break;
        case 'captains':
          await this.voteCaptains(guild, queue, textChannel);
          break;
        case 'random':
          await this.randomizeCaptains(guild, queue, textChannel);
          break;
        default:
          await this.randomizeCaptains(guild, queue, textChannel);
      }
    }
  }

  async voteForSelectionMethod(textChannel, players) {
    const selectionMethods = [
      { name: 'Balanced (Highest MMR)', value: 'balanced' },
      { name: 'Vote for Captains', value: 'captains' },
      { name: 'Random Captains', value: 'random' }
    ];

    const embed = new DefaultEmbed()
      .setTitle('Captain Selection Method')
      .addFields(selectionMethods.map((method, index) => ({ name: `${index + 1}. ${method.name}`, value: '\u200B' })));

    const buttons = new ActionRowBuilder()
      .addComponents(selectionMethods.map((method, index) => 
        new ButtonBuilder()
          .setCustomId(`select_${method.value}`)
          .setLabel(`${method.value}`)
          .setStyle(ButtonStyle.Primary)
      ));

    const message = await textChannel.send({ embeds: [embed], components: [buttons] });
    const collector = message.createMessageComponentCollector({ time: 30000 });

    return new Promise((resolve) => {
      collector.on('collect', async (i) => {
        if (players.includes(i.user.id)) {
          collector.stop(i.customId.split('_')[1]);
        }
      });

      collector.on('end', (collected, reason) => {
        resolve(reason);
      });
    });
  }

  async selectSecondCaptain(guild, queue, firstCaptain, largeTeam) {
    const eligiblePlayers = queue.filter(playerId => 
      playerId !== firstCaptain && !largeTeam.players.includes(playerId)
    );
  
    const playerButtons = [];
    const playerList = eligiblePlayers.map((id, index) => `${index + 1}. <@${id}> - 0 votes`);
  
    for (let i = 0; i < Math.ceil(eligiblePlayers.length / 5); i++) {
      const row = new ActionRowBuilder();
      for (let j = i * 5 + 1; j <= Math.min((i + 1) * 5, eligiblePlayers.length); j++) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`vote_${j}`)
            .setLabel(`${j}`)
            .setStyle(ButtonStyle.Primary)
        );
      }
      playerButtons.push(row);
    }
  
    const captainSelectionEmbed = new DefaultEmbed()
      .setTitle("Second Captain Selection")
      .setDescription("Vote for the second captain by using the corresponding buttons below.")
      .addFields({ name: "Eligible Players", value: playerList.join('\n') })
      .setFooter({ text: "Voting ends in 30 seconds" });
  
    const message = await textChannel.send({ embeds: [captainSelectionEmbed], components: playerButtons });
  
    const votes = new Map();
    const collector = message.createMessageComponentCollector({ time: 30000 });
  
    collector.on('collect', async (interaction) => {
      await interaction.deferUpdate();
      const voteIndex = parseInt(interaction.customId.split('_')[1]) - 1;
      const votedPlayer = eligiblePlayers[voteIndex];
      votes.set(votedPlayer, (votes.get(votedPlayer) || 0) + 1);
  
      const updatedPlayerList = eligiblePlayers.map((id, index) => 
        `${index + 1}. <@${id}> - ${votes.get(id) || 0} votes`
      );
  
      captainSelectionEmbed.setFields({ name: "Eligible Players", value: updatedPlayerList.join('\n') });
      await message.edit({ embeds: [captainSelectionEmbed] });
  
      await interaction.reply({ content: `You voted for <@${votedPlayer}>!`, ephemeral: true });
    });
  
    return new Promise((resolve) => {
      collector.on('end', () => {
        const sortedVotes = [...votes.entries()].sort((a, b) => b[1] - a[1]);
        resolve(sortedVotes.length > 0 ? sortedVotes[0][0] : eligiblePlayers[0]);
      });
    });
  }

  async selectBalancedCaptains(guild, queue, textChannel) {
    const playerMMRs = await Promise.all(queue.map(async playerId => {
      const playerData = await db.get(`player_${guild.id}_${playerId}`);
      return { id: playerId, mmr: playerData ? playerData.mmr : 1000 };
    }));

    playerMMRs.sort((a, b) => b.mmr - a.mmr);
    const captains = [playerMMRs[0].id, playerMMRs[1].id];

    this.client.emit('teamSelection', guild, captains, queue, textChannel);
  }


async voteCaptains(guild, queue, textChannel) {
    const playerButtons = [];
    const playerList = queue.map((id, index) => `${index + 1}. <@${id}> - 0 votes`);
    const votingTime = 30; // 30 seconds for voting
    let timeLeft = votingTime;

    for (let i = 0; i < Math.ceil(queue.length / 5); i++) {
        const row = new ActionRowBuilder();
        for (let j = i * 5 + 1; j <= Math.min((i + 1) * 5, queue.length); j++) {
            const playerId = queue[j - 1];

            const member = await guild.members.fetch(playerId).catch(err => {
                console.error(`Error fetching member ${playerId}:`, err);
                return null;
            });

            if (!member) continue;


            const name = member.nickname || member.displayName || member.user.username;

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`vote_${j}`)
                    .setLabel(`${j}. ${name}`)
                    .setStyle(ButtonStyle.Primary)
            );
        }
        playerButtons.push(row);
    }

    const captainSelectionEmbed = new DefaultEmbed()
        .setTitle("Captain Selection")
        .setDescription("Vote for two captains by using the corresponding buttons below.")
        .addFields({ name: "Players", value: playerList.join('\n') }) 
        .setFooter({ text: `Voting ends in ${timeLeft} seconds.` });

        const message = await textChannel.send({ embeds: [captainSelectionEmbed], components: playerButtons });

        const interval = setInterval(async () => {
            timeLeft -= 5; 
            if (timeLeft > 0) {
                captainSelectionEmbed.setFooter({ text: `Voting ends in ${timeLeft} seconds.` });
                await message.edit({ embeds: [captainSelectionEmbed] });
            } else {
                clearInterval(interval);
                await handleRandomSelection(); 
            }
        }, 5000); 
    
        const handleRandomSelection = async () => {
            const randomCaptain = queue[Math.floor(Math.random() * queue.length)];
            await textChannel.send(`Time's up! Random captain selected: <@${randomCaptain}>.`);
          };

    const votes = new Map();
    const voterChoices = new Map();

    const collector = message.createMessageComponentCollector({ time: 30000 });

    collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();
        const voteIndex = parseInt(interaction.customId.split('_')[1]) - 1;
        const votedPlayer = queue[voteIndex];

        if (!voterChoices.has(interaction.user.id)) {
            voterChoices.set(interaction.user.id, new Set());
        }
        const userVotes = voterChoices.get(interaction.user.id);

        if (userVotes.has(votedPlayer)) {
            await interaction.reply({ content: "You've already voted for this player!", ephemeral: true });
            return;
        }

        if (userVotes.size >= 2) {
            await interaction.reply({ content: "You've already used both of your votes!", ephemeral: true });
            return;
        }

        userVotes.add(votedPlayer);
        votes.set(votedPlayer, (votes.get(votedPlayer) || 0) + 1);

        const updatedPlayerList = queue.map((id, index) => `${index + 1}. <@${id}> - ${votes.get(id) || 0} votes`);

        captainSelectionEmbed.setFields({ name: "Players", value: updatedPlayerList.join('\n') });
        await message.edit({ embeds: [captainSelectionEmbed] });

        await interaction.reply({ content: `You voted for <@${votedPlayer}>! You have ${2 - userVotes.size} vote(s) left.`, ephemeral: true });
    });

    collector.on('end', () => {
        const voteTally = new Map();
        voterChoices.forEach((choices) => {
            choices.forEach((playerId) => {
                voteTally.set(playerId, (voteTally.get(playerId) || 0) + 1);
            });
        });

        const sortedCandidates = [...voteTally.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([playerId]) => playerId);

        const captains = sortedCandidates.length >= 2 ? 
            sortedCandidates.slice(0, 2) : 
            this.shuffleArray([...queue]).slice(0, 2);

        this.client.emit('teamSelection', guild, captains, queue, textChannel);
    });
}
  // async voteCaptains(guild, queue, textChannel) {
  //   const playerButtons = [];
  //   const playerList = queue.map((id, index) => `${index + 1}. <@${id}> - 0 votes`);

  //   for (let i = 0; i < Math.ceil(queue.length / 5); i++) {
  //     const row = new ActionRowBuilder();
  //     for (let j = i * 5 + 1; j <= Math.min((i + 1) * 5, queue.length); j++) {
  //       row.addComponents(
  //         new ButtonBuilder()
  //           .setCustomId(`vote_${j}`)
  //           .setLabel(`${j}`)
  //           .setStyle(ButtonStyle.Primary)
  //       );
  //     }
  //     playerButtons.push(row);
  //   }

  //   const captainSelectionEmbed = new DefaultEmbed()
  //     .setTitle("Captain Selection")
  //     .setDescription("Vote for two captains by using corresponding buttons below.")
  //     .addFields({ name: "Players", value: playerList.join('\n') })
  //     .setFooter({ text: "Voting ends in 30 seconds" });

  //   const message = await textChannel.send({ embeds: [captainSelectionEmbed], components: playerButtons });

  //   const votes = new Map();
  //   const voterChoices = new Map();

  //   const collector = message.createMessageComponentCollector({ time: 30000 });

  //   collector.on('collect', async (interaction) => {
  //     const voteIndex = parseInt(interaction.customId.split('_')[1]) - 1;
  //     const votedPlayer = queue[voteIndex];
    
  //     if (!voterChoices.has(interaction.user.id)) {
  //       voterChoices.set(interaction.user.id, new Set());
  //     }
  //     const userVotes = voterChoices.get(interaction.user.id);
    
  //     if (userVotes.has(votedPlayer)) {
  //       await interaction.reply({ content: "You've already voted for this player!", ephemeral: true });
  //       return;
  //     }
    
  //     if (userVotes.size >= 2) {
  //       await interaction.reply({ content: "You've already used both of your votes!", ephemeral: true });
  //       return;
  //     }
    
  //     userVotes.add(votedPlayer);
  //     votes.set(votedPlayer, (votes.get(votedPlayer) || 0) + 1);
    
  //     const updatedPlayerList = queue.map((id, index) => 
  //       `${index + 1}. <@${id}> - ${votes.get(id) || 0} votes`
  //     );
    
  //     captainSelectionEmbed.setFields({ name: "Players", value: updatedPlayerList.join('\n') });
  //     await message.edit({ embeds: [captainSelectionEmbed] });
    
  //     await interaction.reply({ content: `You voted for <@${votedPlayer}>! You have ${2 - userVotes.size} vote(s) left.`, ephemeral: true });
  //   });

  //   collector.on('end', () => {
  //     const voteTally = new Map();
  //     voterChoices.forEach((choices) => {
  //       choices.forEach((playerId) => {
  //         voteTally.set(playerId, (voteTally.get(playerId) || 0) + 1);
  //       });
  //     });
    
  //     const sortedCandidates = [...voteTally.entries()]
  //       .sort((a, b) => b[1] - a[1])
  //       .map(([playerId]) => playerId);
    
  //     const captains = sortedCandidates.length >= 2 ? 
  //       sortedCandidates.slice(0, 2) : 
  //       this.shuffleArray([...queue]).slice(0, 2);
    
  //     this.client.emit('teamSelection', guild, captains, queue, textChannel);
  //   });
  // }

  async randomizeCaptains(guild, queue, textChannel) {
    const captains = this.shuffleArray([...queue]).slice(0, 2);
    this.client.emit('teamSelection', guild, captains, queue, textChannel);
  }


  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
};