const fs = require('fs');
const path = require('path');

/**
 * Fungsi utama untuk handle berbagai jenis pesan
 * @param {Message} msg - objek pesan dari whatsapp-web.js
 */
async function handleMessage(msg) {
    console.log(`📩 New message from ${msg.from} | Type: ${msg.type}`);
    // Handle pesan dengan media
    if (msg.hasMedia) {
        const media = await msg.downloadMedia();

        if (!media) {
            console.log('⚠️ Media tidak bisa di-download.');
            return;
        }

        const extension = media.mimetype.split('/')[1].split(';')[0]; // e.g., 'jpeg', 'pdf'
        const filename = msg.type === 'document' ? (media.filename || `document.${extension}`) : `${Date.now()}.${extension}`;
        const filePath = path.join(__dirname, 'downloads', filename);

        // Simpan media ke folder
        const buffer = Buffer.from(media.data, 'base64');
        fs.writeFileSync(filePath, buffer);

        console.log(`📎 Media saved: ${filePath}`);
        if (msg.caption) {
            console.log(`📝 Caption: ${msg.caption}`);
        }

    } else {
        // Handle pesan teks biasa
        switch (msg.type) {
            case 'chat':
                console.log(`💬 Text: ${msg.body}`);
                break;

            case 'vcard':
                console.log(`📇 VCard:\n${msg.body}`);
                break;

            case 'location':
                console.log(`📍 Location: ${msg.location.latitude}, ${msg.location.longitude}`);
                break;

            case 'ptt': // voice note
                console.log(`🎤 Voice message received.`);
                break;

            case 'sticker':
                console.log('🌟 Sticker received.');
                break;

            default:
                console.log(`📦 Unknown message type: ${msg.type}`);
                break;
        }
    }
}

module.exports = handleMessage;
