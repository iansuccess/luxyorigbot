const {
    PermissionsBitField, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');

const BOT_OWNER_ID = '1531611262159687820'; // ✅ BOT OWNER ID MO

// ✅ SETUP COMMAND — OWNER ONLY
async function executeSetup(interaction) {
    // ✅ BOT OWNER LANG PWEDE
    if (interaction.user.id !== BOT_OWNER_ID) {
        return interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor('#ff0044')
                .setTitle('⤷ Access Denied')
                .setDescription('Only **Bot Owner** can use this command.')],
            ephemeral: true
        });
    }

    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: '⤷ Use this in server only.', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    try {
        // ✅ 1. GUMAGAWA NG CATEGORY
        const category = await guild.channels.create({
            name: 'Welcomer',
            type: ChannelType.GuildCategory,
            position: 0,
            reason: 'Welcome System Setup'
        });

        // ✅ 2. GUMAGAWA NG Blaze Entrance
        const entranceCh = await guild.channels.create({
            name: 'Blaze Entrance',
            type: ChannelType.GuildText,
            parent: category.id,
            reason: 'Welcome Channel'
        });

        // ✅ 3. GUMAGAWA NG Blaze Exit
        const exitCh = await guild.channels.create({
            name: 'Blaze Exit',
            type: ChannelType.GuildText,
            parent: category.id,
            reason: 'Leave/Exit Channel'
        });

        return interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor('#00ff66')
                .setTitle('⤷ Welcome System Setup Complete')
                .setDescription(`**Category:** \`Welcomer\`\n**Entrance:** ${entranceCh}\n**Exit:** ${exitCh}\n\nChannels created and ready!`)]
        });

    } catch (err) {
        console.error('Setup Error:', err);
        return interaction.editReply({ content: `❌ Error: ${err.message}` });
    }
}

// ✅ JOIN MESSAGE — Blaze Entrance
async function sendJoinMessage(member, entranceChannel) {
    const guild = member.guild;
    const totalMembers = guild.memberCount;
    const joinPosition = totalMembers; // ✅ Pang-ilang member siya

    const embed = new EmbedBuilder()
        .setColor('#ffffff') // ✅ WHITE EMBED
        .setAuthor({
            name: member.user.tag,
            iconURL: member.user.displayAvatarURL({ dynamic: true, size: 512 }) // ✅ TOP LEFT = Avatar ng user
        })
        .setThumbnail('https://i.imgur.com/mt91n0j.png') // ✅ TOP RIGHT = Blazecity Logo (2nd pic style) — PALITAN MO KUNG MERON KA NG SARILI
        .setImage('https://i.imgur.com/rDnK9GV.png') // ✅ BOTTOM IMAGE = LA CHICAS / Blazecity Banner — PALITAN MO NG SARILI MO
        .addFields(
            { name: '<a:Bell:1546826577449582612> Blaze Entrance', value: `**<a:WhiteArrow:1547245007814004876> user, ${member}!**`, inline: false },
            { name: '<a:WhiteArrow:1547245007814004876> Member Count', value: `**<a:WhiteArrow:1547245007814004876> Position:** #${joinPosition}`, inline: true }
        )
        .setTimestamp();

    await entranceChannel.send({ embeds: [embed] }).catch(console.error);
}

// ✅ EXIT/LEAVE/KICK MESSAGE — Blaze Exit
async function sendExitMessage(member, exitChannel, reason = 'User Left') {
    const guild = member.guild;
    const totalMembers = guild.memberCount;

    let statusText = '<a:WhiteArrow:1547245007814004876> User Left';
    if (reason === 'KICK') statusText = '<a:WhiteArrow:1547245007814004876> Kicked from Server';
    else if (reason === 'BAN') statusText = '<a:WhiteArrow:1547245007814004876> Banned from Server';

    const embed = new EmbedBuilder()
        .setColor('#ffffff') // ✅ WHITE EMBED
        .setAuthor({
            name: member.user.tag,
            iconURL: member.user.displayAvatarURL({ dynamic: true, size: 512 }) // ✅ TOP LEFT = Avatar ng user
        })
        .setThumbnail('https://i.imgur.com/mt91n0j.png') // ✅ TOP RIGHT = Blazecity Logo (2nd pic style) — PALITAN MO KUNG MERON KA NG SARILI
        .setImage('https://i.imgur.com/rDnK9GV.png') // ✅ BOTTOM IMAGE = Banner
        .addFields(
            { name: '<a:Bell:1546826577449582612> Blaze Exit', value: `<a:WhiteArrow:1547245007814004876> has departed.`, inline: false },
            { name: '<a:WhiteArrow:1547245007814004876> Status', value: `${statusText}\n**<a:WhiteArrow:1547245007814004876> Total Members:** ${totalMembers}`, inline: true }
        )
        .setTimestamp();

    await exitChannel.send({ embeds: [embed] }).catch(console.error);
}

// ✅ HELPER: KUNIN YUNG CHANNELS
async function getWelcomeChannels(guild) {
    const category = guild.channels.cache.find(c => c.name === 'Welcomer' && c.type === ChannelType.GuildCategory);
    if (!category) return { entrance: null, exit: null };

    const entrance = guild.channels.cache.find(c => c.name === 'blaze-entrance' && c.parentId === category.id);
    const exit = guild.channels.cache.find(c => c.name === 'blaze-exit' && c.parentId === category.id);

    return { entrance, exit };
}

module.exports = {
    executeSetup,
    sendJoinMessage,
    sendExitMessage,
    getWelcomeChannels
};