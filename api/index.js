// Vercel Serverless Function entry point
// Exports the Express app instance so Vercel can run it as a serverless function
const app = require('../backend/server');

module.exports = app;
