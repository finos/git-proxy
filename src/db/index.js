const nodemailer = require('nodemailer');
const generator = require('generate-password');
const passwordHash = require('password-hash');
const validator = require('email-validator');
const config = require('../config');

if (config.getDatabase().type === 'fs') {
  sink = require('../db/file');
}

if (config.getDatabase().type === 'mongo') {
  sink = require('../db/mongo');
}

module.exports.createUser = async (
    username, password, email, gitAccount,
    canPull=false, canPush=false, canAuthorise=false, admin=false) => {
  console.log('creating user');
  const data = {
    username: username,
    password: passwordHash.generate(password),
    gitAccount: gitAccount,
    email: email,
    admin: admin,
    canPull: canPull,
    canPush: canPush,
    canAuthorise: canAuthorise,
    changePassword: true,
    token: generator.generate({length: 10, numbers: true}),
  };

  const existingUser = await sink.findUser(username);

  if (existingUser) {
    const errorMessage = `user ${username} already exists`;
    throw new Error(errorMessage);
  }

  sink.createUser(data);

  await wrapedSendMail(data, password);
};

const wrapedSendMail = function(data, password) {
  return new Promise((resolve, reject) => {
    const emailConfig = config.getTempPasswordConfig();

    if (!emailConfig.sendEmail) {
      resolve();
      return;
    }

    if (!validator.validate(data.email)) {
      resolve();
      return;
    }

    const transporter = nodemailer.createTransport(emailConfig.emailConfig);

    const mailOptions = {
      from: emailConfig.from,
      to: data.email,
      subject: 'Git Proxy - temporary password',
      text: `Your tempoary password is ${password}`,
    };

    transporter.sendMail(mailOptions, function(error, info) {
      if (error) {
        console.log(`error is ${error}`);
        reject(error);
      } else {
        console.log('Email sent: ' + info.response);
        resolve(true);
      }
    });
  });
};

// The module exports
module.exports.authorise = sink.authorise;
module.exports.reject = sink.reject;
module.exports.cancel = sink.cancel;
module.exports.getPushes = sink.getPushes;
module.exports.writeAudit = sink.writeAudit;
module.exports.getPush = sink.getPush;
module.exports.findUser = sink.findUser;
module.exports.getUsers = sink.getUsers;
module.exports.deleteUser = sink.deleteUser;
module.exports.updateUser = sink.updateUser;
module.exports.getRepos = sink.getRepos;
module.exports.getRepo = sink.getRepo;
module.exports.createRepo = sink.createRepo;
module.exports.addUserCanPush = sink.addUserCanPush;
module.exports.addUserCanAuthorise = sink.addUserCanAuthorise;
module.exports.deleteRepo = sink.deleteRepo;
