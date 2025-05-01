const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const dbQuery = require('./dbQuery');
const http = require('http');
const cron = require('node-cron');
const moment = require('moment-timezone');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const formidable = require('formidable');
const cors = require('cors');

const corsMiddleware = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // If it's a preflight request, send a 204 status
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }
};

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Client is ready!');
});

const UPLOAD_DIR = path.join(__dirname, "public", "uploads", "broadcast");

function sanitizeFileName(originalName) {
    const baseName = path.parse(originalName).name.replace(/\s+/g, "_");
    const ext = path.extname(originalName);
    let finalName = `${baseName}${ext}`;
    let counter = 1;

    while (fs.existsSync(path.join(UPLOAD_DIR, finalName))) {
        finalName = `${baseName}(${counter})${ext}`;
        counter++;
    }

    return finalName;
}

client.on('message', async msg => {
    console.log(`📩 Message from ${msg.from}: ${msg.body}`);
    pesanPengirim = msg.body;
    nomorPengirim = msg.from
    // console.log('Pesan lengkap:', JSON.stringify(msg, null, 2));

    if (!msg.from.includes('@c.us')) return;

    // checkSession = await dbQuery('SELECT * FROM t_sesi_pesan WHERE no_wa = $1', [msg.from]);
    // if (checkSession.length === 0){
    //     await dbQuery('INSERT INTO t_sesi_pesan (no_wa, status_interaksi_bot, status_chat) VALUES ($1, $2, $3)', [msg.from, 'Ya', 'Berjalan']);
    // }

});

client.initialize();

const server = http.createServer((req, res) => {
    corsMiddleware(req, res);
    if (req.method === 'POST' && req.url === '/send_to_chatbot') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let { no_wa, pesan, status_pengiriman, waktu_pengiriman, nama_file } = data;

                if (!no_wa || !pesan || !status_pengiriman) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ status: 'error', message: 'no_wa, pesan, dan status_pengiriman wajib diisi' }));
                }

                if (!Array.isArray(no_wa)) {
                    no_wa = [no_wa];
                }

                const kirimPesan = async () => {
                    for (let nomor of no_wa) {
                        if (nomor.startsWith('08')) {
                            nomor = '62' + nomor.slice(1);
                        }
                        nomor = nomor + '@c.us';
                        if (pesan && !data.nama_file) {
                            await client.sendMessage(nomor, pesan);
                        } else if (data.nama_file) {
                            const filePath = path.join(__dirname, 'public', 'uploads', 'broadcast', data.nama_file);
                            const media = MessageMedia.fromFilePath(filePath);
                            await client.sendMessage(nomor, media, pesan ? { caption: pesan } : {});
                        
                        // Tidak ada isi
                        } else {
                            console.log('⚠️ Tidak ada pesan atau file untuk dikirim.');
                        }
                    }
                    console.log('✅ Pesan berhasil dikirim.');
                };

                if (status_pengiriman === 'Langsung') {
                    await kirimPesan();
                } else if (status_pengiriman === 'Terjadwal') {
                    if (!waktu_pengiriman) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ status: 'error', message: 'waktu_pengiriman wajib untuk terjadwal' }));
                    }

                    const waktuJakarta = moment.tz(waktu_pengiriman, 'Asia/Jakarta');
                    const cronTime = `${waktuJakarta.minute()} ${waktuJakarta.hour()} ${waktuJakarta.date()} ${waktuJakarta.month() + 1} *`;

                    console.log('⏰ Pesan dijadwalkan dengan cron time:', cronTime);

                    cron.schedule(cronTime, async () => {
                        console.log('🚀 Waktunya kirim pesan terjadwal.');
                        await kirimPesan();
                    });
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success', message: 'Proses pengiriman di-handle.' }));

            } catch (err) {
                console.error('❌ Error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: 'Gagal proses pengiriman' }));
            }
        });
    }else if (req.method === 'POST' && req.url === '/upload-attachment') {
        const form = new formidable.IncomingForm();

        // Set direktori upload
        form.uploadDir = UPLOAD_DIR;
        form.keepExtensions = true; // Pertahankan ekstensi asli

        form.parse(req, (err, fields, files) => {
            if (err) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, message: "File upload failed" }));
                return;
            }

            const uploadedFile = files.file[0];
            const tempPath = uploadedFile.filepath;
            const originalName = uploadedFile.originalFilename;

            // Generate nama file baru yang aman (tanpa spasi, unik)
            const sanitizedFileName = sanitizeFileName(originalName);
            const finalPath = path.join(form.uploadDir, sanitizedFileName);

            // Rename file
            fs.rename(tempPath, finalPath, (err) => {
                if (err) {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: false, message: "File rename failed" }));
                    return;
                }

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        success: true,
                        filename: sanitizedFileName,
                        url: `/uploads/broadcast/${sanitizedFileName}`,
                    })
                );
            });
        });
    }else if (req.method === 'GET' && req.url.startsWith('/public/')) {
        const filePath = path.join(__dirname, req.url);
    
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File not found');
            } else {
                const ext = path.extname(filePath).toLowerCase();
                const contentTypeMap = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp'
                };
    
                const contentType = contentTypeMap[ext] || 'application/octet-stream';
    
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data);
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'Endpoint tidak ditemukan' }));
    }

});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🌐 Server running on http://localhost:${PORT}`);
});