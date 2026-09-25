const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// === CONFIG ===
const DATA_PATH = path.join(__dirname, 'data', 'luxyMarry.json');
const SHOP_DATA_PATH = path.join(__dirname, 'data', 'luxyShop.json');
const OWNER_IDS = ['1531611262159687820', '1437451567401009286'];

const YES_EMOJI = '<a:verify:1539238356003848344>';
const NO_EMOJI = '<a:wrong1:1539239292394803311>';
const LOL_EMOJI = '<a:LOL:1541450123723149332>';

// Ring definitions
const RINGS = {
    common: { name: 'Common Ring', emoji: '<a:y_Ring:1541442705706451006>', price: 50000 },
    rare: { name: 'Rare Ring', emoji: '<a:SC_Ring:1541442918668046356>', price: 200000 },
    celestial: { name: 'Celestial Ring', emoji: '<a:b_ring:1541443229407256576>', price: 500000 },
    divine: { name: 'Divine Ring', emoji: '<a:08_ring:1541443469178835045>', price: 1000000 }
};

let marriages = {};
let pending = {};

// ✅ FIXED: Get user's rings — valid only + NO DUPLICATES
function getUserRings(userId) {
    try {
        if (!fs.existsSync(SHOP_DATA_PATH)) return [];
        const userItems = JSON.parse(fs.readFileSync(SHOP_DATA_PATH, 'utf-8'));
        const allRings = userItems[userId] || [];
        // Keep only valid rings + remove duplicates → fixes COMPONENT_OPTION_VALUE_DUPLICATED
        return [...new Set(allRings.filter(id => RINGS[id]))];
    } catch (e) {
        console.error('[GET RINGS ERROR]', e);
        return [];
    }
}

function saveMarriages() { fs.writeFileSync(DATA_PATH, JSON.stringify(marriages, null, 2)); }

function takeRing(userId, ringId) {
    try {
        if (!fs.existsSync(SHOP_DATA_PATH)) return;
        const userItems = JSON.parse(fs.readFileSync(SHOP_DATA_PATH, 'utf-8'));
        if (userItems[userId]) {
            // Remove ONE instance of this ringId (works even with duplicates stored)
            const idx = userItems[userId].indexOf(ringId);
            if (idx !== -1) userItems[userId].splice(idx, 1);
            fs.writeFileSync(SHOP_DATA_PATH, JSON.stringify(userItems, null, 2));
        }
    } catch (e) { console.error('[TAKE RING ERROR]', e); }
}

function isMarried(guildId, userId) {
    return marriages[guildId]?.[userId] ?? null;
}

function marryUsers(guildId, userA, userB, ringId) {
    if (!marriages[guildId]) marriages[guildId] = {};
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    marriages[guildId][userA] = { spouse: userB, ringId, date };
    marriages[guildId][userB] = { spouse: userA, ringId, date };
    saveMarriages();
}

function divorceUsers(guildId, userA, userB) {
    if (marriages[guildId]) {
        delete marriages[guildId][userA];
        delete marriages[guildId][userB];
        saveMarriages();
    }
}

// Load saved data
try {
    if (!fs.existsSync(path.dirname(DATA_PATH))) fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    if (fs.existsSync(DATA_PATH)) marriages = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
} catch (e) { console.error('[MARRY LOAD]', e); }

module.exports = {
    async handleMessageCommand(message) {
        const content = message.content.trim();
        const userId = message.author.id;
        const guildId = message.guild.id;
        const args = content.split(/\s+/);
        const cmd = args[0].toLowerCase();

        // === ,give item — OWNER ONLY ===
        if (cmd === ',give') {
            if (!OWNER_IDS.includes(userId)) {
                return message.reply('⚠️ Only bot owners can use this command!');
            }
            const type = args[1]?.toLowerCase();
            const ringId = args[2]?.toLowerCase();
            const target = message.mentions.users.first();

            if (type !== 'item' || !ringId || !RINGS[ringId] || !target) {
                return;
            }
            try {
                if (!fs.existsSync(SHOP_DATA_PATH)) fs.writeFileSync(SHOP_DATA_PATH, '{}');
                const userItems = JSON.parse(fs.readFileSync(SHOP_DATA_PATH, 'utf-8'));
                if (!userItems[target.id]) userItems[target.id] = [];
                userItems[target.id].push(ringId);
                fs.writeFileSync(SHOP_DATA_PATH, JSON.stringify(userItems, null, 2));
                return;
            } catch (e) {
                console.error('[GIVE ITEM ERROR]', e);
                return message.reply('⚠️ Error giving item!');
            }
        }

        // === ,marry — Propose ===
        if (cmd === ',marry') {
            const target = message.mentions.users.first();

            // No mention → Show guide
            if (!target) {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#7700ff')
                        .setTitle('💍 How to Use Marriage Command')
                        .setDescription(`
**Command:** \`,marry @User\`

📋 **Requirements:**
• Buy a ring first using \`,shop\`
• Choose which ring to use for proposing
• Wait for them to say **Yes**!

⚠️ Rings are consumed upon marriage — you must buy a new one if you divorce.
                        `)
                    ], allowedMentions: { repliedUsers: false }
                });
            }

            // Validation
            if (target.bot || target.id === userId) {
                return message.reply('⚠️ You cannot propose to yourself or a bot!');
            }
            if (isMarried(guildId, userId) || isMarried(guildId, target.id)) {
                return message.reply('⚠️ One of you is already married! Divorce first.');
            }

            // ✅ Get valid rings (no duplicates, no invalid IDs)
            const rings = getUserRings(userId);

            // ✅ SAFETY CHECK: prevent empty select menu
            if (rings.length === 0) {
                return message.reply('⚠️ You need a valid ring to propose! Use \`,shop\` to buy one.');
            }

            // ✅ Build select menu — guaranteed unique values
            const select = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`marry:propose:${target.id}`)
                    .setPlaceholder('Choose a ring to propose with...')
                    .addOptions(rings.map(id => ({
                        label: RINGS[id].name,
                        emoji: RINGS[id].emoji,
                        value: id
                    })))
            );

            return message.reply({
                content: `${message.author} wants to propose to ${target}! Pick a ring:`,
                components: [select],
                allowedMentions: { repliedUsers: false }
            });
        }

        // === ,whose — Check Marriage ===
        if (cmd.toLowerCase() === ',whose') {
            const info = isMarried(guildId, userId);
            if (!info) {
                return message.reply({
                    content: `${LOL_EMOJI} **You're not married yet LOL.** Find a girl first, then come back HAHA 😂`,
                    allowedMentions: { repliedUsers: false }
                });
            }

            const ring = RINGS[info.ringId];
            if (!ring) {
                return message.reply('⚠️ Ring data not found!');
            }

            const proposer = message.author;
            const spouse = await message.client.users.fetch(info.spouse).catch(() => null);
            const propAvatar = proposer.displayAvatarURL({ dynamic: true, size: 256 });

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#7700ff')
                    .setTitle('<a:Bouquet:1541458194130538567> Marriage Record')
                    .setDescription(`
**${proposer}**  ❤️  <@${info.spouse}>

⤷ **Proposer:** <@${userId}>
⤷ **Spouse:** <@${info.spouse}>
⤷ **Ring:** ${ring.emoji} ${ring.name}
⤷ **Married Since:** ${info.date}
                    `)
                    .setThumbnail(propAvatar)
                ]
            });
        }

        // === ,endmarriage / ,divorce ===
        if (cmd.toLowerCase() === ',endmarriage' || cmd.toLowerCase() === ',divorce') {
            const info = isMarried(guildId, userId);
            if (!info) {
                return message.reply('⚠️ You are not married!');
            }
            const spouseId = info.spouse;
            return message.reply({
                content: `<@${userId}> wants to end the marriage with <@${spouseId}>!\nBoth must agree to divorce.`,
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`marry:divorce:yes:${spouseId}`).setLabel('Yes, Divorce').setStyle(ButtonStyle.Danger).setEmoji(NO_EMOJI),
                    new ButtonBuilder().setCustomId(`marry:divorce:no:${spouseId}`).setLabel('No, Stay Married').setStyle(ButtonStyle.Success).setEmoji(YES_EMOJI)
                )], allowedMentions: { repliedUsers: false }
            });
        }
    },

    async handleButtonInteraction(interaction) {
        const parts = interaction.customId.split(':');
        const action = parts[1];
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // === PROPOSE → Show Yes/No buttons ===
        if (action === 'propose') {
            const targetId = parts[2];
            const ringId = interaction.values?.[0];
            if (!ringId || !RINGS[ringId]) return;

            pending[targetId] = { proposer: userId, ringId, guildId };

            const ring = RINGS[ringId];
            return interaction.update({
                content: `<@${userId}> is proposing to you <@${targetId}> with ${ring.emoji} **${ring.name}**!\nDo you accept?`,
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`marry:accept:${targetId}`).setLabel('Yes').setStyle(ButtonStyle.Success).setEmoji(YES_EMOJI),
                    new ButtonBuilder().setCustomId(`marry:reject:${targetId}`).setLabel('No').setStyle(ButtonStyle.Danger).setEmoji(NO_EMOJI)
                )], allowedMentions: { repliedUsers: false }
            });
        }

        // === ACCEPT PROPOSAL ===
        if (action === 'accept') {
            const data = pending[userId];
            if (!data || data.guildId !== guildId) {
                return interaction.reply({ content: '⚠️ No pending proposal!', ephemeral: true });
            }
            const ring = RINGS[data.ringId];
            takeRing(data.proposer, data.ringId);
            marryUsers(guildId, data.proposer, userId, data.ringId);
            delete pending[userId];

            const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            const proposerUser = await interaction.client.users.fetch(data.proposer);
            const spouseUser = await interaction.client.users.fetch(userId);
            const propAvatar = proposerUser.displayAvatarURL({ dynamic: true, size: 256 });
            const spouseAvatar = spouseUser.displayAvatarURL({ dynamic: true, size: 256 });

            return interaction.update({
                content: '',
                embeds: [new EmbedBuilder()
                    .setColor('#7700ff')
                    .setTitle('<a:Bouquet:1541458194130538567> I now pronounce you married')
                    .setThumbnail(propAvatar)
                    .setImage(spouseAvatar)
                    .setDescription(`
<@${data.proposer}> ❤️ <@${userId}>

⤷ **Proposer:** <@${data.proposer}>
⤷ **Spouse:** <@${userId}>
⤷ **Ring:** ${ring.emoji} ${ring.name}
⤷ **Wedding Date:** ${date}
                    `)
                ], components: []
            });
        }

        // === REJECT PROPOSAL ===
        if (action === 'reject') {
            delete pending[userId];
            return interaction.update({ content: '💔 Proposal rejected.', components: [] });
        }

        // === DIVORCE YES ===
        if (action === 'divorce' && parts[2] === 'yes') {
            const spouseId = parts[3];
            const info = isMarried(guildId, userId);
            if (!info || info.spouse !== spouseId) {
                return interaction.reply({ content: '⚠️ Not married to that user!', ephemeral: true });
            }
            divorceUsers(guildId, userId, spouseId);
            return interaction.update({ content: '💔 Marriage ended. Buy a new ring to marry again.', components: [] });
        }

        // === DIVORCE NO ===
        if (action === 'divorce' && parts[2] === 'no') {
            return interaction.update({ content: '❤️ Still happily married!', components: [] });
        }
    }
};