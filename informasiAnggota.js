const dbQuery = require('./dbQuery');
const { normalizePhoneNumber } = require('./phoneUtils');

exports.informasiAnggota = async function(phoneNumber) {
    try {

        const normalizedPhone = normalizePhoneNumber(phoneNumber);
        const result = await dbQuery(
            `SELECT * FROM t_anggota 
             WHERE no_wa = $1 OR no_wa = $2`,
            [normalizedPhone, normalizedPhone]
        );
        
        if (result.length === 0) {
            return 'Maaf, data anggota tidak ditemukan. Pastikan nomor WhatsApp Anda terdaftar sebagai anggota.';
        }
        
        const anggota = result[0];
        // const formattedDate = new Date(anggota.tanggal_daftar).toLocaleDateString('id-ID');
        
        return `Informasi Anggota: \n
            ========== Informasi Pribadi ========== \n
            👤 Nama: ${anggota.nama_lengkap} \n
            🔢 No. Anggota: ${anggota.nik} \n
            🏠 Alamat: ${anggota.alamat} \n
            📱 WhatsApp: ${anggota.no_wa} \n
            📅 Tempat Tanggal Lahir: ${anggota.tempat_lahir}, ${anggota.tanggal_lahir} \n \n
            ========== Informasi Keluarga ========== \n
            👤 Nama: ${anggota.nama_lengkap} \n
            🔢 No. Anggota: ${anggota.nik} \n
            🏠 Alamat: ${anggota.alamat} \n
            📱 WhatsApp: ${anggota.no_wa} \n
            📅 Tempat Tanggal Lahir: ${anggota.tempat_lahir}, ${anggota.tanggal_lahir} \n \n
            ========== Informasi Pendiidkan ========== \n
            👤 Nama: ${anggota.nama_lengkap} \n
            🔢 No. Anggota: ${anggota.nik} \n
            🏠 Alamat: ${anggota.alamat} \n
            📱 WhatsApp: ${anggota.no_wa} \n
            📅 Tempat Tanggal Lahir: ${anggota.tempat_lahir}, ${anggota.tanggal_lahir} \n \n
            ========== Informasi Pekerjaan ========== \n
            👤 Nama: ${anggota.nama_lengkap} \n
            🔢 No. Anggota: ${anggota.nik} \n
            🏠 Alamat: ${anggota.alamat} \n
            📱 WhatsApp: ${anggota.no_wa} \n
            📅 Tempat Tanggal Lahir: ${anggota.tempat_lahir}, ${anggota.tanggal_lahir} \n \n
            ========== Informasi Organisasi ========== \n
            👤 Nama: ${anggota.nama_lengkap} \n
            🔢 No. Anggota: ${anggota.nik} \n
            🏠 Alamat: ${anggota.alamat} \n
            📱 WhatsApp: ${anggota.no_wa} \n
            📅 Tempat Tanggal Lahir: ${anggota.tempat_lahir}, ${anggota.tanggal_lahir} \n \n
            ========== Informasi Keterampilan ========== \n
            👤 Nama: ${anggota.nama_lengkap} \n
            🔢 No. Anggota: ${anggota.nik} \n
            🏠 Alamat: ${anggota.alamat} \n
            📱 WhatsApp: ${anggota.no_wa} \n
            📅 Tempat Tanggal Lahir: ${anggota.tempat_lahir}, ${anggota.tanggal_lahir} \n \n
            ========== Informasi Minat ========== \n
            👤 Nama: ${anggota.nama_lengkap} \n
            🔢 No. Anggota: ${anggota.nik} \n
            🏠 Alamat: ${anggota.alamat} \n
            📱 WhatsApp: ${anggota.no_wa} \n
            📅 Tempat Tanggal Lahir: ${anggota.tempat_lahir}, ${anggota.tanggal_lahir} \n \n
            `;
        } catch (error) {
            console.error('Error in informasiAnggota:', error);
            return 'Maaf, terjadi kesalahan saat mengambil data anggota. Silakan coba lagi nanti.';
        }
};