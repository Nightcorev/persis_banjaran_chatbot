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
const { informasiAnggota } = require('./informasiAnggota');
const { informasiIuran } = require('./informasiIuran');

// Create the botFunctions object
const botFunctions = {
    informasiAnggota,
    informasiIuran
};

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
    if (!msg.from.includes('@c.us')) return;

    try {
        // Filter hanya pesan dari user, bukan group atau broadcast
        if (!msg.from.includes('@c.us')) return;

        const pesanPengirim = msg.body;
        const nomorPengirim = msg.from;

        console.log(`📩 Message from ${nomorPengirim}: ${pesanPengirim}`);

        // Cek apakah user sudah punya sesi
        let session = await dbQuery('SELECT * FROM t_sesi_pesan WHERE no_wa = $1 AND status_chat = $2', [nomorPengirim, 'Berjalan']);
        console.log(session);
        if (session.length === 0) {
            console.log('🟡 Sesi belum ada, buat sesi baru');
            await dbQuery(
                'INSERT INTO t_sesi_pesan (no_wa, status_interaksi_bot, status_chat) VALUES ($1, $2, $3)',
                [nomorPengirim, 'Ya', 'Berjalan']
            );
            session = await dbQuery('SELECT * FROM t_sesi_pesan WHERE no_wa = $1', [nomorPengirim]);
        } else {
            console.log('🟢 Sesi sudah ada');
        }

        // Cek riwayat pesan terakhir
        const checkChat = await dbQuery(
            'SELECT * FROM t_riwayat_pesan WHERE id_sesi_pesan = $1 ORDER BY id_respon_bot DESC LIMIT 1',
            [session[0].id_sesi_pesan]
        );

       if (checkChat.length === 0) {
           console.log('📥 Belum ada riwayat chat, kirim daftar menu');
           const rows = await dbQuery('SELECT * FROM t_respon_bot ORDER BY keyword ASC');
           let menuText = 'Selamat datang di Layanan Informasi Persis Banjaran. \n Silakan pilih salah satu menu berikut dengan membalas pesan ini menggunakan angka yang sesuai: \n';
           rows.forEach(row => {
               menuText += `[${row.keyword}] ${row.pesan}\n`;
           });

           await client.sendMessage(nomorPengirim, menuText);

            await dbQuery(
                'INSERT INTO t_riwayat_pesan (id_sesi_pesan, pesan) VALUES ($1, $2)',
                [session[0].id_sesi_pesan, pesanPengirim]
            );
        } else {
            console.log('📨 Sudah ada riwayat chat, lanjutkan percakapan');
            if (!/^\d+$/.test(pesanPengirim)) {
                await client.sendMessage(nomorPengirim, 'Mohon untuk memilih menu dengan mengetikan angka yang tersedia');
                return;
            }
            const botResponse = await dbQuery('SELECT * FROM t_respon_bot WHERE keyword = $1', [pesanPengirim]);
            if (botResponse.length > 0) {
                console.log(`✅ Keyword dikenali: ${botResponse.keyword}, tipe: ${botResponse.tipe_respon}`);
                if (botResponse.tipe_respon === 'statis') {
                    console.log('📤 Mengirim jawaban statis');
                    await client.sendMessage(nomorPengirim, botResponse.jawaban);
                    await dbQuery(
                        'INSERT INTO t_riwayat_pesan (id_sesi_pesan, id_respon_bot, pesan) VALUES ($1, $2, $3)',
                        [session[0].id_sesi_pesan, botResponse.id_respon_bot, pesanPengirim]
                    );
                } else {
                    console.log('📌 Keyword dengan tipe dinamis (belum ditangani)');
                    let responseText = '';
                    if (botResponse[0].function && botFunctions[botResponse[0].function]) {
                        const functionName = botResponse[0].function;
                        responseText = await botFunctions[functionName](nomorPengirim);
                    } else {
                        responseText = 'Maaf, menu tersebut belum tersedia.';
                    }
                    await client.sendMessage(nomorPengirim, responseText);

                    await dbQuery(
                        'INSERT INTO t_riwayat_pesan (id_sesi_pesan, id_respon_bot, pesan) VALUES ($1, $2, $3)',
                        [session[0].id_sesi_pesan, botResponse.id_respon_bot, 'belum diimplement']
                    );
                    // Tambahkan logika untuk respon dinamis di sini
                }
                await dbQuery(
                    'UPDATE t_sesi_pesan SET status_chat = $1, status_interaksi_bot = $2 WHERE no_wa = $3',
                    ['Selesai', 'Tidak', nomorPengirim]
                );
                await client.sendMessage(nomorPengirim, 'Jika ingin mengakses informasi lainnya, silahkan kirim pesan');
            } else {
                console.log('❌ Keyword tidak ditemukan');
                await client.sendMessage(nomorPengirim, 'Maaf, menu tidak tersedia. Silahkan ketik sesuai menu yang tersedia.');
            }
        }
    } catch (err) {
        console.error('❌ Error dalam pemrosesan pesan:', err);
        await msg.reply('Terjadi kesalahan pada sistem. Mohon coba beberapa saat lagi.');
    }
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
                    for (let i = 0; i < no_wa.length; i++) {
                        let nomor = no_wa[i];
                        if (nomor.startsWith('08')) {
                            nomor = '62' + nomor.slice(1);
                        }
                        nomor = nomor + '@c.us';
                
                        try {
                            if (pesan && !data.nama_file) {
                                await client.sendMessage(nomor, pesan);
                            } else if (data.nama_file) {
                                const filePath = path.join(__dirname, 'public', 'uploads', 'broadcast', data.nama_file);
                                const media = MessageMedia.fromFilePath(filePath);
                                await client.sendMessage(nomor, media, pesan ? { caption: pesan } : {});
                            } else {
                                console.log('⚠️ Tidak ada pesan atau file untuk dikirim.');
                            }
                
                            console.log(`✅ Pesan dikirim ke: ${nomor}`);
                        } catch (error) {
                            console.error(`❌ Gagal kirim ke ${nomor}:`, error.message);
                        }
                
                        // Delay antar pesan (500ms untuk 2 pesan/detik)
                        if (i < no_wa.length - 1) {
                            await sleep(500);
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