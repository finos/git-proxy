#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

const API_BASE_URL = process.env.GIT_PROXY_API_URL || 'http://localhost:3000';
const GIT_PROXY_COOKIE_FILE = path.join(
  process.env.HOME || process.env.USERPROFILE || '',
  '.git-proxy-cookies.json',
);

interface ApiErrorResponse {
  error: string;
}

interface ErrorWithResponse {
  response?: {
    data: ApiErrorResponse;
    status: number;
  };
  code?: string;
  message: string;
}

async function addSSHKey(username: string, keyPath: string): Promise<void> {
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
    const axiosError = error as ErrorWithResponse;
    console.error('Full error:', error);

    if (axiosError.response) {
      console.error('Response error:', axiosError.response.data);
      console.error('Response status:', axiosError.response.status);
    } else if (axiosError.code === 'ENOENT') {
      console.error(`Error: Could not find SSH key file at ${keyPath}`);
    } else {
      console.error('Error:', axiosError.message);
    }
    process.exit(1);
  }
}

async function removeSSHKey(username: string, keyPath: string): Promise<void> {
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
    const axiosError = error as ErrorWithResponse;

    if (axiosError.response) {
      console.error('Error:', axiosError.response.data.error);
    } else if (axiosError.code === 'ENOENT') {
      console.error(`Error: Could not find SSH key file at ${keyPath}`);
    } else {
      console.error('Error:', axiosError.message);
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
  Add SSH key:    npx tsx src/cli/ssh-key.ts add <username> <path-to-public-key>
  Remove SSH key: npx tsx src/cli/ssh-key.ts remove <username> <path-to-public-key>
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
