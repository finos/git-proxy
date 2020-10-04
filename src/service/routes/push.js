const express = require('express');
const router = express.Router();
const db = require('../../db');
const login = require('connect-ensure-login');

router.get('/', (req, res) => {    
  if (req.user) {
    res.send(db.getPushes());  
  } else {
    res.status(401).send({
      message: 'not logged in'
    });
  }
})

router.get('/:id', login.ensureLoggedIn(), function(req, res) {    
  const id = req.params.id
  res.send(db.getPush(id));
})

router.patch('/:id', login.ensureLoggedIn(), function(req, res) {  
  const id = req.params.id  
  const result = db.authorise(id);
  res.send(result);
})

module.exports = router;
