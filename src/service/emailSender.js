const nodemailer = require('nodemailer');
const config = require('../config');

exports.sendEmail = async (to, subject, emailBody) => {
  const smtpHost = config.getSmtpHost();
  const smtpPort = config.getSmtpPort();
  const fromEmail = config.getEmailNotificationFromAddress();
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
  });

  const email = `<h1>Welcome To GIT Proxy</h1>${emailBody}`;
  const info = await transporter.sendMail({
    from: fromEmail,
    to, subject,
    html: email,
  });
  console.log('Message sent: %s', info.messageId);
};
