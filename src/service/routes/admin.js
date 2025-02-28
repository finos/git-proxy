const express = require('express');
const router = new express.Router();
const { isAdmin } = require('../middleware/authorization');
const db = require('../../db');

// Apply isAdmin middleware to all routes in this router
router.use(isAdmin);

// Admin routes
router.get('/users', async (req, res) => {
  try {
    const users = await db.getUsers();
    // Remove sensitive information
    const sanitizedUsers = users.map(user => {
      const sanitizedUser = { ...user };
      delete sanitizedUser.password;
      return sanitizedUser;
    });
    res.status(200).json(sanitizedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add more admin routes as needed

module.exports = router;
