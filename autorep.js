// autorep.js
// Auto-reply for image/picture permission keywords

const TRIGGER_KEYWORDS = ['image', 'picture', 'pic', 'image perm', 'img'];
const REPLY_MESSAGE = 'rep for image perm or buy it from our shop using luxy currency type `,shop` to buy and `,mine` to earn money!';

// ✅ CHECK KUNG MAY KEYWORD SA MENSAHE
function containsTrigger(content) {
    const lower = content.toLowerCase();
    return TRIGGER_KEYWORDS.some(keyword => lower.includes(keyword));
}

// ✅ AUTO REPLY HANDLER
async function handleAutoReply(message) {
    // Skip bots
    if (message.author.bot) return;

    // Skip kung walang content
    if (!message.content) return;

    // Skip kung command (nagsisimula sa , o / o !)
    const trimmed = message.content.trim();
    if (trimmed.startsWith(',') || trimmed.startsWith('/') || trimmed.startsWith('!') || trimmed.startsWith('.')) return;

    // Check kung may trigger keyword
    if (!containsTrigger(trimmed)) return;

    // ✅ I-SEND ANG AUTO REPLY
    try {
        await message.reply(REPLY_MESSAGE);
    } catch (e) {
        console.error('[AUTOREP ERROR]', e);
    }
}

module.exports = { handleAutoReply };