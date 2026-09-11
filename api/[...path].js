// Vercel maps this catch-all function to /api/*.
// The Express app keeps the complete /api/... request path, so its existing
// route definitions work unchanged.
module.exports = require('../backend/server');
