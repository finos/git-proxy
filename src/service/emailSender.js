const nodemailer = require('nodemailer');
const config = require('../config');

exports.sendEmail = async (from, to, subject, body) => {
  const smtpHost = config.getSmtpHost();
  const smtpPort = config.getSmtpPort();
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
  });

  const email = `${body}`;
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html: email,
  });
  console.log('Message sent %s', info.messageId);
};
