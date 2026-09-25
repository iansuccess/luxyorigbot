const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// === CONFIG ===
const DATA_PATH = path.join(__dirname, 'data', 'luxyShop.json');
const ECO_PATH = path.join(__dirname, 'data', 'luxyEconomy.json');
const OWNER_IDS = ['1531611262159687820', '1437451567401009286'];

const SHOP_EMOJI = '<a:Shop:1541445966744522849>';
const RINGS = {
    common: { name: 'Common Ring', emoji: '<a:y_Ring:1541442705706451006>', price: 50000 },
    rare: { name: 'Rare Ring', emoji: '<a:SC_Ring:1541442918668046356>', price: 200000 },
    celestial: { name: 'Celestial Ring', emoji: '<a:b_ring:1541443229407256576>', price: 500000 },
    divine: { name: 'Divine Ring', emoji: '<a:08_ring:1541443469178835045>', price: 1000000 },
    // ✅ BAGONG ITEM — ROLE
    role: {
        name: 'Image Perms Role',
        emoji: '<a:QuestionMark:1549409873111023746>',
        price: 1000000,
        roleId: '1543407000426250351'
    }
};

// === DATA LOAD/SAVE ===
let userItems = {};
function loadData() {
    try {
        if (!fs.existsSync(path.dirname(DATA_PATH))) fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
        if (fs.existsSync(DATA_PATH)) userItems = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    } catch (e) { console.error('[SHOP LOAD]', e); userItems = {}; }
}
function saveData() { fs.writeFileSync(DATA_PATH, JSON.stringify(userItems, null, 2)); }

// ✅ AYUS NA: GAMITIN ANG PAREHONG SISTEMA NG LUXYGAME
function getBalance(userId) {
    try {
        if (!fs.existsSync(ECO_PATH)) return 50000;
        const data = JSON.parse(fs.readFileSync(ECO_PATH, 'utf-8'));
        return Number(data[userId] || 50000);
    } catch { return 50000; }
}

// ✅ AYUS NA: TAMA NA ANG PAG-SAVE — TALAGANG BABAWASAN ANG PERA MO
function setBalance(userId, amount) {
    try {
        let data = {};
        if (fs.existsSync(ECO_PATH)) {
            data = JSON.parse(fs.readFileSync(ECO_PATH, 'utf-8'));
        }
        data[userId] = Math.max(0, Number(amount));
        fs.writeFileSync(ECO_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('[SHOP SETBALANCE ERROR]', e);
    }
}

function addItem(userId, ringId) {
    if (!userItems[userId]) userItems[userId] = [];
    if (!userItems[userId].includes(ringId)) userItems[userId].push(ringId);
    saveData();
}
function hasItem(userId, ringId) {
    return userItems[userId]?.includes(ringId) ?? false;
}
function getUserRings(userId) {
    return userItems[userId] || [];
}

// ✅ BAGONG FUNCTION — MAG-ADD NG ROLE SA USER
async function addRole(member, roleId) {
    try {
        const role = member.guild.roles.cache.get(roleId);
        if (!role) {
            console.error(`[SHOP ROLE] Role ${roleId} not found in guild.`);
            return false;
        }
        await member.roles.add(role);
        return true;
    } catch (e) {
        console.error('[SHOP ROLE ERROR]', e);
        return false;
    }
}

loadData();

module.exports = {
    getUserRings,
    hasItem,
    RINGS,

    async handleMessageCommand(message) {
        const content = message.content.trim();
        const userId = message.author.id;
        const args = content.split(/\s+/);
        const cmd = args[0].toLowerCase();

        // === ,shop ===
        if (cmd === ',shop') {
            const embed = new EmbedBuilder()
                .setColor('#7700ff')
                .setTitle(`${SHOP_EMOJI} Luxy's Shop`)
                .setDescription(Object.entries(RINGS).map(([k, r]) =>
                    `⤷ ${r.emoji} **${r.name}** — ${r.price.toLocaleString()} Cash`
                ).join('\n'));

            const select = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('shop:buy')
                    .setPlaceholder('Pick an item that you would like to buy.')
                    .addOptions(Object.entries(RINGS).map(([id, r]) => ({
                        label: r.name,
                        description: `Price: ${r.price.toLocaleString()} Cash`,
                        value: id,
                        emoji: r.emoji
                    })))
            );
            return message.reply({ embeds: [embed], components: [select], allowedMentions: { repliedUsers: false } });
        }

        // === ,give item ===
        if (cmd === ',give' && args[1]?.toLowerCase() === 'item') {
            if (!OWNER_IDS.includes(userId)) return;
            const ringId = args[2]?.toLowerCase();
            const target = message.mentions.users.first();
            if (!RINGS[ringId] || !target) {
                return message.reply('⚠️ Usage: `,give item ringid @user`\nAvailable items: `common`, `rare`, `celestial`, `divine`, `role`');
            }
            addItem(target.id, ringId);
            return message.reply(`<a:verify:1539238356003848344> Gave ${RINGS[ringId].emoji} **${RINGS[ringId].name}** to ${target}`);
        }
    },

    async handleButtonInteraction(interaction) {
        if (!interaction.customId.startsWith('shop:')) return;
        const userId = interaction.user.id;
        const ringId = interaction.values?.[0];
        if (!ringId || !RINGS[ringId]) return;

        const ring = RINGS[ringId];
        const bal = getBalance(userId);

        if (hasItem(userId, ringId)) {
            return interaction.reply({ content: `⚠️ You already own ${ring.emoji} **${ring.name}**!`, ephemeral: true });
        }
        if (bal < ring.price) {
            return interaction.reply({ content: `⚠️ Not enough cash! Need **${ring.price.toLocaleString()}**, you have **${bal.toLocaleString()}**`, ephemeral: true });
        }

        // ✅ AYUS NA: TALAGANG BABAWASAN NA ANG PERA MO
        setBalance(userId, bal - ring.price);
        addItem(userId, ringId);

        // ✅ KUNG ROLE ANG BINILI, I-ADD ANG ROLE SA USER
        if (ring.roleId) {
            const added = await addRole(interaction.member, ring.roleId);
            if (!added) {
                return interaction.reply({ content: `⚠️ Bought the item, but failed to give the role. Please contact an admin.`, ephemeral: true });
            }
            return interaction.reply({ content: `<a:verify:1539238356003848344> Bought ${ring.emoji} **${ring.name}**! You now have the role!`, ephemeral: false });
        }

        return interaction.reply({ content: `<a:verify:1539238356003848344> Bought ${ring.emoji} **${ring.name}**! You can now propose to someone!`, ephemeral: false });
    }
};