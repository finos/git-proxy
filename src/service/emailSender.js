const nodemailer = require('nodemailer');
const config = require('../config');

exports.sendEmail = async ( to, subject, emailBody) => {
  const smtpHost = config.getSmtpHost();
  const smtpPort = config.getSmtpPort();
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
  });

  const email = `<h1>Welcome To GIT Proxy</h1>${emailBody}`;
  const info = await transporter.sendMail({
    from: config.getEmailNotificationFrom,
    to, subject,
    html: email,
  });
  console.log('Message sent: %s', info.messageId);
};
