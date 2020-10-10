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
  if (req.user) {
    const id = req.params.id  
    res.send(db.getPush(id));
  } else {
    res.status(401).send({
      message: 'not logged in'
    });
  }
})

router.post('/:id/reject', login.ensureLoggedIn(), function(req, res) { 
  if (req.user) { 
    const id = req.params.id  
    const result = db.reject(id);
    res.send(result);
  } else {
    res.status(401).send({
      message: 'not logged in'
    });
  }
});

router.post('/:id/authorise', login.ensureLoggedIn(), function(req, res) { 
  if (req.user) { 
    const id = req.params.id  
    const result = db.authorise(id);
    res.send(result);
  } else {
    res.status(401).send({
      message: 'not logged in'
    });
  }
});

router.post('/:id/cancel', login.ensureLoggedIn(), function(req, res) { 
  if (req.user) { 
    const id = req.params.id  
    const result = db.cancel(id);
    res.send(result);
  } else {
    res.status(401).send({
      message: 'not logged in'
    });
  }
});

module.exports = router;
