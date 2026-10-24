require('dotenv').config();

module.exports = {
    app: {
        port: process.env.PORT,
        frontendUrl: process.env.FRONTEND_URL,
    }
};