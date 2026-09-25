const { ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const EMOJI_WRONG = '<a:wrong1:1539239292394803311>';
const EMOJI_VERIFY = '<a:verify:1539238356003848344>';

const vcOwnersPath = path.join(__dirname, 'data', 'vcowners.json');

// ✅ Load list ng may-ari ng VC
function getVCOwners() {
    if (!fs.existsSync(vcOwnersPath)) {
        fs.mkdirSync(path.dirname(vcOwnersPath), { recursive: true });
        fs.writeFileSync(vcOwnersPath, '{}');
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(vcOwnersPath, 'utf8'));
    } catch (e) {
        console.error('Error reading vcowners:', e);
        return {};
    }
}

// ✅ I-save kung sino ang may-ari ng bagong VC
function saveVCOwner(channelId, ownerId) {
    const owners = getVCOwners();
    owners[channelId] = ownerId;
    fs.writeFileSync(vcOwnersPath, JSON.stringify(owners, null, 2));
    console.log(`✅ VC Saved — Channel: ${channelId} | Owner: ${ownerId}`);
}

// ✅ Check kung pwede mag-edit ng VC
async function canManageVC(member, voiceChannel) {
    if (!voiceChannel) return false;

    // Admin / Server Owner — laging pwede
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        console.log(`✅ Admin Pass: ${member.user.tag}`);
        return true;
    }
    if (member.id === member.guild.ownerId) {
        console.log(`✅ Server Owner Pass: ${member.user.tag}`);
        return true;
    }

    // Check kung siya ang may-ari
    const owners = getVCOwners();
    const ownerId = owners[voiceChannel.id];
    const isOwner = ownerId === member.id;

    console.log(`🔍 Check — Channel: ${voiceChannel.name} | Owner: ${ownerId} | You: ${member.id} | ${isOwner ? '✅ ALLOW' : '❌ DENY'}`);
    return isOwner;
}

// ✅ Kapag pumasok sa "Click Me" — gumawa ng sariling VC
async function handleVoiceStateUpdate(oldState, newState, config) {
    const guild = newState.guild;
    if (!guild) return;

    const setup = config.vcSetups?.[guild.id];
    if (!setup) return;

    // Pumasok sa trigger channel → gumawa ng bago
    if (newState.channelId === setup.triggerId && newState.member) {
        // Kung may naiwan na walang tao sa lumang VC, burahin
        if (oldState.channelId && oldState.channelId !== newState.channelId) {
            const oldVC = guild.channels.cache.get(oldState.channelId);
            if (oldVC && oldVC.members.size === 0 && getVCOwners()[oldVC.id]) {
                setTimeout(() => {
                    if (oldVC.members.size === 0) {
                        oldVC.delete().catch(() => {});
                        const owners = getVCOwners();
                        delete owners[oldVC.id];
                        fs.writeFileSync(vcOwnersPath, JSON.stringify(owners, null, 2));
                    }
                }, 5000);
            }
        }

        // Gumawa ng bagong VC
        const newVC = await guild.channels.create({
            name: `${newState.member.user.username}'s Channel`,
            type: ChannelType.GuildVoice,
            parent: setup.categoryId,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect] },
                { id: newState.member.id, allow: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.MoveMembers] }
            ]
        });

        // I-save kung sino ang may-ari
        saveVCOwner(newVC.id, newState.member.id);

        // Ilipat ang user sa bagong VC
        await newState.setChannel(newVC);
    }

    // Lumabas ng VC → kung walang tao, burahin
    if (oldState.channelId && !newState.channelId) {
        const oldVC = guild.channels.cache.get(oldState.channelId);
        if (!oldVC) return;
        const owners = getVCOwners();
        if (owners[oldVC.id] && oldVC.members.size === 0) {
            setTimeout(() => {
                if (oldVC.members.size === 0) {
                    oldVC.delete().catch(() => {});
                    delete owners[oldVC.id];
                    fs.writeFileSync(vcOwnersPath, JSON.stringify(owners, null, 2));
                }
            }, 3000);
        }
    }
}

// ✅ Mga button action
async function handleButtonInteraction(interaction, config) {
    const memberVC = interaction.member.voice.channel;
    if (!memberVC) {
        return interaction.reply({ content: `${EMOJI_WRONG} Join a voice channel first!`, ephemeral: true });
    }

    const setup = config.vcSetups?.[interaction.guild.id];
    if (setup && memberVC.id === setup.triggerId) {
        return interaction.reply({ content: `${EMOJI_WRONG} Join your own private channel first!`, ephemeral: true });
    }

    if (!(await canManageVC(interaction.member, memberVC))) {
        return interaction.reply({
            content: `${EMOJI_WRONG} Not allowed!\n\n✅ Only:\n• Channel Owner\n• Administrators / Server Owner`,
            ephemeral: true
        });
    }

    const everyone = interaction.guild.roles.everyone.id;

    switch (interaction.customId) {
        case 'lock_vc':
            await memberVC.permissionOverwrites.edit(everyone, { Connect: false });
            return interaction.reply({ content: `${EMOJI_VERIFY} Channel **LOCKED** 🔒`, ephemeral: true });
        case 'unlock_vc':
            await memberVC.permissionOverwrites.edit(everyone, { Connect: true });
            return interaction.reply({ content: `${EMOJI_VERIFY} Channel **UNLOCKED** 🔓`, ephemeral: true });
        case 'trust_user': {
            const modal = new ModalBuilder()
                .setCustomId('trust_modal')
                .setTitle('Trust User');
            const userInput = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('User ID')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(userInput));
            return interaction.showModal(modal);
        }
        case 'untrust_user': {
            const modal = new ModalBuilder()
                .setCustomId('untrust_modal')
                .setTitle('Untrust User');
            const userInput = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('User ID')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(userInput));
            return interaction.showModal(modal);
        }
        case 'rename_vc': {
            const modal = new ModalBuilder()
                .setCustomId('rename_vc_modal')
                .setTitle('Rename Channel');
            const nameInput = new TextInputBuilder()
                .setCustomId('new_name')
                .setLabel('New Channel Name')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
            return interaction.showModal(modal);
        }
    }
}

// ✅ Handle Modal (Rename / Trust / Untrust)
async function handleModalInteraction(interaction, config) {
    await interaction.deferReply({ ephemeral: true });
    const memberVC = interaction.member.voice.channel;
    if (!memberVC) {
        return interaction.editReply(`${EMOJI_WRONG} Join a voice channel first!`);
    }
    if (!(await canManageVC(interaction.member, memberVC))) {
        return interaction.editReply(`${EMOJI_WRONG} You don't own this channel!`);
    }

    switch (interaction.customId) {
        case 'rename_vc_modal': {
            const newName = interaction.fields.getTextInputValue('new_name');
            await memberVC.setName(newName);
            return interaction.editReply(`${EMOJI_VERIFY} Channel renamed to: **${newName}**`);
        }
        case 'trust_modal': {
            const uid = interaction.fields.getTextInputValue('user_id');
            await memberVC.permissionOverwrites.edit(uid, { Connect: true, ViewChannel: true });
            return interaction.editReply(`${EMOJI_VERIFY} User trusted ✅`);
        }
        case 'untrust_modal': {
            const uid = interaction.fields.getTextInputValue('user_id');
            await memberVC.permissionOverwrites.edit(uid, { Connect: false });
            return interaction.editReply(`${EMOJI_VERIFY} User untrusted ✅`);
        }
    }
}

module.exports = {
    handleVoiceStateUpdate,
    handleButtonInteraction,
    handleModalInteraction,
    getVCOwners,
    saveVCOwner,
    canManageVC
};