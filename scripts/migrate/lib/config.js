const path = require('path');

const today = new Date().toISOString().split('T')[0];

module.exports = {
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017',
  dbName: process.env.DB_NAME || 'git_proxy',
  reportsDir: path.join(process.cwd(), 'reports', `${today}-migration`),
  ensureReportsDir: function() {
    const fs = require('fs');
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  },
};
