'use strict';

const express = require('express');
const router = express.Router();
const controller= require('./controller');

const sendSucces = (req, res) => {
  res.send('');
};


router.get('/ping', (req, res) => {
  res.send('pong');
});

router.get('/sendTest',
  controller.sendTest,
  sendSucces
);

router.get('/data',
  controller.getData
);

router.post('/receiveMessage',
  controller.processMessage,
  sendSucces
);

module.exports = router;