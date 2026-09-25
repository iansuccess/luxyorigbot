const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data', 'adConfig.json');
let adConfig = {};

function loadConfig() {
    try {
        if (fs.existsSync(DATA_PATH)) {
            adConfig = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
        }
    } catch (e) {
        adConfig = {};
    }
}
function saveConfig() {
    try {
        fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
        fs.writeFileSync(DATA_PATH, JSON.stringify(adConfig, null, 2));
    } catch (e) {
        console.error('[AD] Save error:', e.message);
    }
}
loadConfig();

// ✅ EKSATONG AD MESSAGE
const AD_MESSAGE = `_ _ rep: @ change here
# _ _                      [†BlazeCity](https://discord.gg/B9WH2KphWB)

-# _ _                                ﹒__s__tox ﹒**nsfw** ﹒malulupet
-# _ _                                ﹒filo ﹒@everyone
_ _
                                    [Blaze/City](https://open.spotify.com/track/3oDkdAySo1VQQG0ptV7uwa?si=5f807a1ce2f24334)`;

// ✅ /adsetup — ROLE LANG, WALA NANG CATEGORY
const setupCommand = new SlashCommandBuilder()
    .setName('adsetup')
    .setDescription('Set role na pwede mag .ad — OWNER ONLY')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(o => o
        .setName('role')
        .setDescription('Role na pwede mag-ad')
        .setRequired(true)
    );

// ✅ .ad command — check role → delete message → send ad
async function handleAdCommand(message) {
    if (message.author.bot || !message.guild) return;
    const cfg = adConfig[message.guild.id];
    if (!cfg || !cfg.roleId) return;
    // may role o admin o owner = pwede
    if (!message.member.roles.cache.has(cfg.roleId) &&
        !message.member.permissions.has(PermissionFlagsBits.Administrator) &&
        message.guild.ownerId !== message.author.id) {
        return;
    }
    await message.delete().catch(() => {});
    await message.channel.send(AD_MESSAGE.trim());
}

// ✅ /adsetup — SERVER OWNER LANG ANG PWEDE!
async function handleSlashSetup(interaction) {
    // 🔒 SERVER OWNER LANG — HINDI PWEDENG ADMIN!
    if (interaction.guild.ownerId !== interaction.user.id) {
        return interaction.reply({ content: '❌ Only Server Owner can use this command.', ephemeral: true });
    }

    const role = interaction.options.getRole('role');
    adConfig[interaction.guild.id] = { roleId: role.id };
    saveConfig();

    // ✅ EKSATONG REPLY MO
    await interaction.reply('<a:verify:1539238356003848344>  **Ad Setup Complete!**');
}

module.exports = {
    setupCommand,
    handleAdCommand,
    handleSlashSetup
};