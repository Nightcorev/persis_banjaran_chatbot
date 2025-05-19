exports.normalizePhoneNumber = (whatsappNumber) => {
    // Hilangkan @c.us jika ada
    let phone = whatsappNumber.replace('@c.us', '');
    
    // Ganti prefix 62 dengan 0
    if (phone.startsWith('62')) {
        phone = '0' + phone.substring(2);
    }
    
    return phone;
};