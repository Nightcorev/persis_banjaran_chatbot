const dbQuery = require('./dbQuery');
const { normalizePhoneNumber } = require('./phoneUtils');

exports.informasiIuran = async function(phoneNumber) {
    try {
        const normalizedPhone = normalizePhoneNumber(phoneNumber);
        
        // Get anggota data
        const anggotaResult = await dbQuery(
            `SELECT id, nama_lengkap FROM t_anggota 
             WHERE no_telp = $1 OR no_wa = $2`,
            [normalizedPhone, normalizedPhone]
        );
        
        if (anggotaResult.length === 0) {
            return 'Maaf, data anggota tidak ditemukan. Pastikan nomor WhatsApp Anda terdaftar sebagai anggota.';
        }
        
        const anggota = anggotaResult[0];
        
        // Get iuran logs for this anggota
        const iuranLogs = await dbQuery(
            `SELECT * FROM t_iuran_log 
             WHERE anggota_id = $1 
             ORDER BY tanggal`,
            [anggota.id]
        );
        
        if (iuranLogs.length === 0) {
            return `Tidak ada data iuran untuk anggota ${anggota.nama_lengkap}.`;
        }
        
        // Current month and year
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1; // January is 0
        
        // Process iuran data
        let totalPaid = 0;
        let totalUnpaid = 0;
        let paidDetails = {};
        let unpaidMonths = [];
        
        // Initialize unpaid months for current year
        for (let month = 1; month <= currentMonth; month++) {
            unpaidMonths.push({
                month,
                year: currentYear,
                nominal: 10000 // Assuming 10,000 per month
            });
        }
        
        // Process each payment log
        iuranLogs.forEach(log => {
            const paymentDate = new Date(log.tanggal);
            const formattedDate = paymentDate.toLocaleDateString('id-ID');
            
            try {
                const paidMonths = JSON.parse(log.paid_months.replace(/"/g, ''));
                const nominalPerMonth = log.nominal / paidMonths.length;
                
                paidMonths.forEach(month => {
                    // Remove from unpaid months
                    unpaidMonths = unpaidMonths.filter(m => 
                        !(m.month === month && m.year === currentYear)
                    );
                    
                    // Add to paid details
                    if (!paidDetails[formattedDate]) {
                        paidDetails[formattedDate] = [];
                    }
                    
                    const monthNames = [
                        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                    ];
                    
                    paidDetails[formattedDate].push({
                        month: monthNames[month - 1],
                        year: currentYear,
                        nominal: nominalPerMonth
                    });
                    
                    totalPaid += nominalPerMonth;
                });
            } catch (e) {
                console.error('Error parsing paid_months:', e);
            }
        });
        
        // Calculate total unpaid
        totalUnpaid = unpaidMonths.reduce((sum, month) => sum + month.nominal, 0);
        
        // Generate output message
        let message = `Informasi Iuran untuk ${anggota.nama_lengkap}\n\n`;
        message += `Total iuran yang belum dibayar sebesar\t: Rp ${totalUnpaid.toLocaleString('id-ID')}\n`;
        message += `Total iuran yang sudah dibayar hingga bulan ${getMonthName(currentMonth)} : Rp ${totalPaid.toLocaleString('id-ID')}\n\n`;
        
        // Paid details
        message += "Detail Lunas:\n";
        for (const [date, payments] of Object.entries(paidDetails)) {
            message += `${date}\n`;
            payments.forEach(payment => {
                message += `- Bulan ${payment.month} ${payment.year}\t: Rp ${payment.nominal.toLocaleString('id-ID')}\n`;
            });
        }
        message += "==================================\n";
        message += `Total Terbayar\t: ${totalPaid.toLocaleString('id-ID')}\n\n`;
        
        // Unpaid details
        message += "Detail Tunggakan:\n";
        unpaidMonths.forEach(month => {
            const monthName = getMonthName(month.month);
            message += `- Bulan ${monthName} ${month.year}\t: Rp ${month.nominal.toLocaleString('id-ID')}\n`;
        });
        message += "=================================\n";
        message += `Total Tunggakan\t: ${totalUnpaid.toLocaleString('id-ID')}\n`;
        
        return message;
    } catch (error) {
        console.error('Error in informasiIuran:', error);
        return 'Maaf, terjadi kesalahan saat mengambil data iuran. Silakan coba lagi nanti.';
    }
};

function getMonthName(monthNumber) {
    const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return monthNames[monthNumber - 1];
}