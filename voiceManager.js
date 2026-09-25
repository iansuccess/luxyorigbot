const { ChannelType, PermissionsBitField, ActionRowBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const vcOwnersPath = path.join(__dirname, 'data', 'vcowners.json');

// ✅ Load list ng may-ari
function getVCOwners() {
  if (!fs.existsSync(vcOwnersPath)) {
    fs.mkdirSync(path.dirname(vcOwnersPath), { recursive: true });
    fs.writeFileSync(vcOwnersPath, '{}');
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(vcOwnersPath, 'utf8'));
  } catch (e) {
    console.error('❌ Error reading vcowners:', e);
    return {};
  }
}

// ✅ I-save kung sino ang may-ari
function saveVCOwner(channelId, ownerId) {
  const owners = getVCOwners();
  owners[channelId] = ownerId;
  fs.writeFileSync(vcOwnersPath, JSON.stringify(owners, null, 2));
  console.log(`✅ OWNER SAVED — Channel: ${channelId} | Owner: ${ownerId}`);
}

// ✅ Check kung pwede mag-manage
async function canManageVC(member, voiceChannel) {
  if (!voiceChannel) return false;

  // Admin / Server Owner — laging pwede
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    console.log(`✅ Admin OK: ${member.user.tag}`);
    return true;
  }
  if (member.id === member.guild.ownerId) {
    console.log(`✅ Server Owner OK: ${member.user.tag}`);
    return true;
  }

  // ✅ Check kung SIYA ang may-ari
  const owners = getVCOwners();
  const ownerId = owners[voiceChannel.id];
  const isOwner = ownerId === member.id;

  console.log(`🔍 CHECK — Channel: ${voiceChannel.name} | SavedOwner: ${ownerId} | You: ${member.id} | ${isOwner ? '✅ ALLOW' : '❌ DENY'}`);
  return isOwner;
}

module.exports = {
  async handleVoiceStateUpdate(oldState, newState, config) {
    const guildId = newState.guild.id;
    const vcSetup = config.vcSetups?.[guildId];
    if (!vcSetup || !vcSetup.categoryId) return;

    // ✅ User joins "Click Me" → Gumawa ng VC + SAVE OWNER
    if (newState.channelId === vcSetup.triggerId) {
      const guild = newState.guild;
      const category = guild.channels.cache.get(vcSetup.categoryId);
      if (!category) return;

      const channel = await guild.channels.create({
        name: `${newState.member.user.username}'s VC`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect]
          },
          {
            id: newState.member.id,
            allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.MuteMembers, PermissionsBitField.Flags.DeafenMembers]
            // ⚠️ TINANGGAL ANG ManageChannels — KAYA HINDI PWEDENG MAG-EDIT ANG USER KUNG WALANG SAVE CHECK
          }
        ]
      });

      // ✅ I-SAVE ANG MAY-ARI — ITO ANG KULANG KANINA!
      saveVCOwner(channel.id, newState.member.id);

      await newState.setChannel(channel);
    }

    // ✅ Delete empty channels
    if (oldState.channelId && oldState.channelId !== vcSetup.triggerId && oldState.channelId !== vcSetup.editChannelId) {
      const channel = oldState.guild.channels.cache.get(oldState.channelId);
      if (channel && channel.parentId === vcSetup.categoryId && channel.members.size === 0) {
        const owners = getVCOwners();
        delete owners[channel.id];
        fs.writeFileSync(vcOwnersPath, JSON.stringify(owners, null, 2));
        await channel.delete().catch(console.error);
      }
    }
  },

  async handleButtonInteraction(interaction, config) {
    try {
      const guildId = interaction.guild.id;
      const vcSetup = config.vcSetups?.[guildId];
      if (!vcSetup) return interaction.reply({ content: 'Voice system not setup here.', ephemeral: true });

      const memberChannel = interaction.member?.voice?.channel;
      if (!memberChannel || memberChannel.parentId !== vcSetup.categoryId || memberChannel.id === vcSetup.triggerId) {
        return interaction.reply({ content: 'You must be in a managed voice channel to use these controls.', ephemeral: true });
      }

      // ✅ DITO NAKA-STUCK KANINA — I-CHECK ANG MAY-ARI
      if (!(await canManageVC(interaction.member, memberChannel))) {
        return interaction.reply({
          content: '<a:wrong1:1539239292394803311> Not allowed!\n\n✅ You can only manage this if:\n• You are the channel owner, OR\n• You are an Administrator\n\nYou cannot modify other people\'s voice channels!',
          ephemeral: true
        });
      }

      if (interaction.customId === 'lock_vc') {
        await memberChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
        return interaction.reply({ content: '🔒 VC Locked.', ephemeral: true });
      }
      if (interaction.customId === 'unlock_vc') {
        await memberChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: true });
        return interaction.reply({ content: '🔓 VC Unlocked.', ephemeral: true });
      }
      if (interaction.customId === 'rename_vc') {
        const modal = new ModalBuilder()
          .setCustomId('rename_vc_modal')
          .setTitle('Edit Voice Channel Name');
        const nameInput = new TextInputBuilder()
          .setCustomId('new_name')
          .setLabel('Channel Name')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(100)
          .setPlaceholder('Ilagay ang bagong pangalan...')
          .setRequired(true);
        const modalRow = new ActionRowBuilder().addComponents(nameInput);
        modal.addComponents(modalRow);
        return interaction.showModal(modal);
      }
      if (interaction.customId === 'trust_user') {
        const selectMenu = new UserSelectMenuBuilder()
          .setCustomId('trust_user_select')
          .setPlaceholder('Select users to trust')
          .setMinValues(1).setMaxValues(1);
        return interaction.reply({ content: 'Select the user you want to **trust**.', components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
      }
      if (interaction.customId === 'untrust_user') {
        const selectMenu = new UserSelectMenuBuilder()
          .setCustomId('untrust_user_select')
          .setPlaceholder('Select users to untrust')
          .setMinValues(1).setMaxValues(1);
        return interaction.reply({ content: 'Select the user you want to **untrust**.', components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
      }
    } catch (error) {
      console.error('[VC Button Error]', error);
      if (!interaction.replied) interaction.reply({ content: '⚠️ An error occurred.', ephemeral: true });
    }
  },

  async handleSelectMenuInteraction(interaction, config) {
    const guildId = interaction.guild.id;
    const vcSetup = config.vcSetups?.[guildId];
    if (!vcSetup) return interaction.reply({ content: 'Voice system not setup.', ephemeral: true });

    const memberChannel = interaction.member?.voice?.channel;
    if (!memberChannel || memberChannel.parentId !== vcSetup.categoryId) {
      return interaction.reply({ content: '<a:wrong1:1539239292394803311> Join your voice channel first.', ephemeral: true });
    }

    // ✅ Check may-ari bago mag-trust/untrust
    if (!(await canManageVC(interaction.member, memberChannel))) {
      return interaction.reply({
        content: '<a:wrong1:1539239292394803311> Not allowed! Only the channel owner can do this.',
        ephemeral: true
      });
    }

    const selectedUser = interaction.users.first();
    if (!selectedUser) return interaction.reply({ content: '<a:wrong1:1539239292394803311> No user selected.', ephemeral: true });
    const member = interaction.guild.members.cache.get(selectedUser.id);
    if (!member) return interaction.reply({ content: '<a:wrong1:1539239292394803311> User not found.', ephemeral: true });

    if (interaction.customId === 'trust_user_select') {
      await memberChannel.permissionOverwrites.edit(member.id, { Connect: true });
      return interaction.reply({ content: `<a:verify:1539238356003848344> **${member.user.tag}** can now join your VC!`, ephemeral: true });
    }
    if (interaction.customId === 'untrust_user_select') {
      const existing = memberChannel.permissionOverwrites.cache.get(member.id);
      if (!existing?.allow?.has(PermissionsBitField.Flags.Connect)) {
        return interaction.reply({ content: '<a:warning1:1539178794210828378> User is NOT trusted.', ephemeral: true });
      }
      await memberChannel.permissionOverwrites.edit(member.id, { Connect: false });
      return interaction.reply({ content: `<a:verify:1539238356003848344> **${member.user.tag}** removed from trusted.`, ephemeral: true });
    }
  },

  async handleModalInteraction(interaction, config) {
    if (interaction.customId === 'rename_vc_modal') {
      const guildId = interaction.guild.id;
      const vcSetup = config.vcSetups?.[guildId];
      if (!vcSetup) return interaction.reply({ content: 'Voice system not setup here.', ephemeral: true });

      const memberChannel = interaction.member?.voice?.channel;
      if (!memberChannel || memberChannel.parentId !== vcSetup.categoryId) {
        return interaction.reply({ content: 'You must be in your own voice channel first.', ephemeral: true });
      }
      if (memberChannel.id === vcSetup.triggerId || memberChannel.id === vcSetup.editChannelId) {
        return interaction.reply({ content: 'You cannot rename the system channels.', ephemeral: true });
      }

      // ✅ Check may-ari bago mag-rename
      if (!(await canManageVC(interaction.member, memberChannel))) {
        return interaction.reply({
          content: '<a:wrong1:1539239292394803311> Not allowed! Only the channel owner can rename this.',
          ephemeral: true
        });
      }

      const newName = interaction.fields.getTextInputValue('new_name').trim();
      if (!newName) {
        return interaction.reply({ content: 'Name cannot be empty.', ephemeral: true });
      }
      try {
        await memberChannel.setName(newName, `Renamed by ${interaction.user.tag}`);
        return interaction.reply({ content: `Channel name changed to: **${newName}**`, ephemeral: true });
      } catch (err) {
        console.error('[RENAME ERROR]', err);
        return interaction.reply({ content: 'Failed to rename channel. Check bot permissions.', ephemeral: true });
      }
    }
  }
};