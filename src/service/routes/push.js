const express = require('express');
const router = express.Router();
const db = require('../../db');
const login = require('connect-ensure-login');



router.get('/', async (req, res) => {    
  if (req.user) {
    res.send(await db.getPushes());  
  } else {
    res.status(401).send({
      message: 'not logged in'
    });
  }
})

router.get('/:id', async(req, res) => {    
  if (req.user) {
    const id = req.params.id  
    res.send(await db.getPush(id));
  } else {
    res.status(401).send({
      message: 'not logged in'
    });
  }
})

router.post('/:id/reject', async(req, res) => { 
  if (req.user) { 
    const id = req.params.id  
    const result = await db.reject(id);
    res.send(result);
  } else {
    res.status(401).send({
      message: 'not logged in'
    });
  }
});

router.post('/:id/authorise',  async (req, res) => { 
  if (req.user) { 
    const id = req.params.id  
    const result = await db.authorise(id);
    res.send(result);
  } else {
    res.status(401).send({
      message: 'not logged in'
    });
  }
});

router.post('/:id/cancel', async (req, res) => { 
  if (req.user) { 
    const id = req.params.id  
    const result = await db.cancel(id);
    res.send(result);
  } else {
    res.status(401).send({
      message: 'not logged in'
    });
  }
});

module.exports = router;
