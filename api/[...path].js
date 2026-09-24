// Vercel catch-all route forwarder
const app = require('../backend/server');

module.exports = (req, res) => {
    return app(req, res);
};

