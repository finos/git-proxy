#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_BASE_URL = process.env.GIT_PROXY_API_URL || 'http://localhost:3000';
const GIT_PROXY_COOKIE_FILE = path.join(
  process.env.HOME || process.env.USERPROFILE,
  '.git-proxy-cookies.json',
);

async function addSSHKey(username, keyPath) {
  try {
    // Check for authentication
    if (!fs.existsSync(GIT_PROXY_COOKIE_FILE)) {
      console.error('Error: Authentication required. Please run "yarn cli login" first.');
      process.exit(1);
    }

    // Read the cookies
    const cookies = JSON.parse(fs.readFileSync(GIT_PROXY_COOKIE_FILE, 'utf8'));

    // Read the public key file
    const publicKey = fs.readFileSync(keyPath, 'utf8').trim();
    console.log('Read public key:', publicKey);

    // Validate the key format
    if (!publicKey.startsWith('ssh-')) {
      console.error('Invalid SSH key format. The key should start with "ssh-"');
      process.exit(1);
    }

    console.log('Making API request to:', `${API_BASE_URL}/api/v1/user/${username}/ssh-keys`);
    // Make the API request
    await axios.post(
      `${API_BASE_URL}/api/v1/user/${username}/ssh-keys`,
      { publicKey },
      {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookies,
        },
      },
    );

    console.log('SSH key added successfully!');
  } catch (error) {
    console.error('Full error:', error);
    if (error.response) {
      console.error('Response error:', error.response.data);
      console.error('Response status:', error.response.status);
    } else if (error.code === 'ENOENT') {
      console.error(`Error: Could not find SSH key file at ${keyPath}`);
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

async function removeSSHKey(username, keyPath) {
  try {
    // Check for authentication
    if (!fs.existsSync(GIT_PROXY_COOKIE_FILE)) {
      console.error('Error: Authentication required. Please run "yarn cli login" first.');
      process.exit(1);
    }

    // Read the cookies
    const cookies = JSON.parse(fs.readFileSync(GIT_PROXY_COOKIE_FILE, 'utf8'));

    // Read the public key file
    const publicKey = fs.readFileSync(keyPath, 'utf8').trim();

    // Make the API request
    await axios.delete(`${API_BASE_URL}/api/v1/user/${username}/ssh-keys`, {
      data: { publicKey },
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookies,
      },
    });

    console.log('SSH key removed successfully!');
  } catch (error) {
    if (error.response) {
      console.error('Error:', error.response.data.error);
    } else if (error.code === 'ENOENT') {
      console.error(`Error: Could not find SSH key file at ${keyPath}`);
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const username = args[1];
const keyPath = args[2];

if (!command || !username || !keyPath) {
  console.log(`
Usage:
  Add SSH key:    node ssh-key.js add <username> <path-to-public-key>
  Remove SSH key: node ssh-key.js remove <username> <path-to-public-key>
  `);
  process.exit(1);
}

if (command === 'add') {
  addSSHKey(username, keyPath);
} else if (command === 'remove') {
  removeSSHKey(username, keyPath);
} else {
  console.error('Invalid command. Use "add" or "remove"');
  process.exit(1);
}
