'use strict';

const accountSid = process.env.TWILIO_ACCOUNT;
const authToken = process.env.TWILIO_SECRECT;
const number = process.env.TWILIO_NUMBER;

//TODO split out sending messages into new file
//TODO split out saving into new file
//TODO Jslint it

const twilio = require('twilio');
const moment = require('moment');
const log = require('./logger');
const client = new twilio(accountSid, authToken);

const tempStorage = {
  people: {},
  rating: {},
  pendingRating: {},
  awaitingFeedback: {},
  feedback: {}
};

const saveMessage = (message) => {
  log.verbose('saving', message.From, message.Body);
};

//TODO this is a beast
const processMessage = async(message) => {
  let testWelcome, testRating, testTakeAction, saveOtrFeedback;
  const regexWelcome = /Hi[,]? I[']?m ([a-zA-Z ]+)/gi;
  const regexRating = /(^[0-9]$)/gi;
  const regexTakeAction = /(^yes|yeah|sure|ok$)/gi;
  const regexSaveFeedBack =  /(#notetoself|#otr)/gi;
  testWelcome = regexWelcome.exec(message.Body);
  testRating = regexRating.exec(message.Body);
  testTakeAction = regexTakeAction.exec(message.Body);
  saveOtrFeedback = regexSaveFeedBack.exec(message.Body);
  if (testWelcome) {
    try {
      if (tempStorage.people[message.From]) {
        const alreadyMet = await sendAlreadyMet(message, testWelcome[1]);
        log.info(`Sent message ${alreadyMet.sid}`);
      } else {
        registerNewUser(message, testWelcome[1]);
        const welcomeText = await sendWelcomeText(message, testWelcome[1]);
        const howsYourDay = await sendHowsYourDay(message);
        log.info(`Sent new user messages ${welcomeText.sid}, ${howsYourDay.sid}`);
      }
    } catch(error) {
      log.error(`Error processing welcome message ${error}`);
    }
  } else if (testRating) {
    try {
      const ratingSaved = saveRating(message, testRating[1]);
      if (ratingSaved) {
        const ratingSavedMessage = await sendRatingSavedMessage(message);
        log.info(`Sent raiting saved message ${ratingSavedMessage.sid}`);
      } else {
        const ratingPendingMessage = await sendRatingPendingMessage(message);
        log.info(`Sent rating pending message ${ratingPendingMessage.sid}`);        
      }
    } catch(error) {
      log.error(`Error processing welcome message ${error}`);
    }
  } else if (saveOtrFeedback) {
    try {
      saveFeedback(message, true);
      const savedOtrFeedback = await sendSavedOtrFeedback(message);
      log.info(`Sent otr feedback message ${savedOtrFeedback.sid}`);
    } catch(error) {
      log.error(`Error processing welcome message ${error}`);
    }
  } else if (testTakeAction) {
    try {
      updateRating(message);
      const ratingSavedMessage = await sendRatingSavedMessage(message);
      log.info(`Sent rating saved message ${ratingSavedMessage.sid}`);
    } catch(error) {
      log.error(`Error processing welcome message ${error}`);
    }
  } else if (tempStorage.awaitingFeedback[message.From]) {
    try {
      saveFeedback(message);
      const savedFeedback = await sendSavedFeedback(message);
      log.info(`Sent feedback saved message ${savedFeedback.sid}`);
    } catch(error) {
      log.error(`Error processing welcome message ${error}`);
    }
  } else {
    try {
      const dontKnowMessage = await sendDontKnowText(message);
      log.info(`Sent don't know message ${dontKnowMessage.sid}`);
    } catch(error) {
      log.error(`Error processing 'no idea' message ${error}`);
    }
  }
};

const sendSavedOtrFeedback = (message) => {
  return client.messages.create({
    to: message.From,
    from: number,
    body: 'Awesome, noted.'
  });
};

const sendSavedFeedback = (message) => {
  return client.messages.create({
    to: message.From,
    from: number,
    body: `Thanks for sharing. I'll save this for future you. Do you have a #notetoself? [#otr]`
  });
};

const sendRatingSavedMessage = (message) => {
  const today = moment().format('YMMDD');
  const key = message.From + today;
  let body, mediaUrl;
  switch(tempStorage.rating[key]) {
  case '0':
    body = `That's terrible.  Just kill yourself`;
    mediaUrl = 'https://media.giphy.com/media/fAykJdJ6SYSYw/giphy.gif';
    break;
  case '1':
    body = `I'm sorry to hear that. If you want to talk about it, tell me why.`;
    break;
  case '2':
  case '3':
    body = `Ok. Do you want to tell me more?`;
    break;
  case '4':
  case '5':
    body = `Excellent. What was so great about it?`;
    break;
  default:
    body = `You're really feeling yourself.`;
    mediaUrl = 'https://media.giphy.com/media/aNTmc4keX4Fva/giphy.gif';
  }
  tempStorage.awaitingFeedback[message.From] = true;
  return client.messages.create({
    to: message.From,
    from: number,
    body,
    mediaUrl
  });
};

const sendRatingPendingMessage = (message) => {
  return client.messages.create({
    to: message.From,
    from: number,
    body: `You've already recorded a pulse today, should I update it?`
  });
};

const sendWelcomeText = (message, name) => {
  return client.messages.create({
    to: message.From,
    from: number,
    body: `Hi ${name} nice to meet you. I'm Tophat and I'll be checking ` +
          `in to get a pulse on how you're feeling. I want you to be ` +
          `open and honest with me but don't worry, I'll be careful with ` +
          `your data. Checkout out my security details: https://www.fjordnet.com`
  });
};

const sendAlreadyMet = (message) => {
  return client.messages.create({
    to: message.From,
    from: number,
    body: `I know ${tempStorage.people[message.From]}, we've met already! How's your day going?`
  });
};


const sendHowsYourDay = (message) => {
  return client.messages.create({
    to: message.From,
    from: number,
    body: `${tempStorage.people[message.From]}, how's your day going?`
  });
};

const sendDontKnowText = (message) => {
  let body;
  if (tempStorage.people[message.From]) {
    body = `Sorry ${tempStorage.people[message.From]}, I don't know how to do that...`;
  } else {
    body = `Sorry, I don't know how to do that. If you meant to log feedback use #notetoself or #otr`;
  }
  return client.messages.create({
    to: message.From,
    from: number,
    body
  });
};

const registerNewUser = (message, name) => {
  tempStorage.people[message.From] = name.trim();
  log.verbose('register', message.From, name);
};

const updateRating = (message) => {
  const today = moment().format('YMMDD');
  const key = message.From + today;
  tempStorage.rating[key] = tempStorage.pendingRating[key];
};

const saveRating = (message, rating) => {
  const today = moment().format('YMMDD');
  const key = message.From + today;
  if (tempStorage.rating[key]) {
    tempStorage.pendingRating[key] = rating;
    log.verbose('pending', message.From, rating);
    return false;  
  } else {
    tempStorage.rating[key] = rating;
    log.verbose('saved', message.From, rating);
    return true;
  }
};

const saveFeedback = (message, otc = false) => {

  const feedback = {feedback: message.Body};
  if (otc) {
    feedback.timestamp = moment().format();
  } else {
    tempStorage.awaitingFeedback[message.From] = false;
    const today = moment().format('YMMDD');
    const key = message.From + today; 
    feedback.rating = tempStorage.rating[key];
    feedback.date = today;
  }
  if (!tempStorage.feedback[message.From]) {
    tempStorage.feedback[message.From] = [];
  }
  tempStorage.feedback[message.From].push(feedback);
};

exports.getData = (req, res) => {
  res.send(tempStorage);
};

//This needs a number and body set before you can use it
exports.sendTest = async(req, res, next) => {
  try {
    const message = await client.messages.create({
      to: '',
      from: number,
      body: ''
    });
    log.info(`Sent message ${message.sid}`);
    next(message.errorCode);
  } catch(error) {
    log.error(`Error sending message ${error}`);
    next(error);
  }
};

exports.processMessage = (req, res, next) => {
  saveMessage(req.body);
  processMessage(req.body);
  next();
};
