const pool = require('./db');

const dbQuery = async (text, params) => {
    try {
        const result = await pool.query(text, params);
        return result.rows;
    } catch (error) {
        console.error('❌ DB Query Error:', error);
        throw error;
    }
};

module.exports = dbQuery;
