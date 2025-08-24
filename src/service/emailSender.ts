import nodemailer from 'nodemailer';
import * as config from '../config';

export const sendEmail = async (from: string, to: string, subject: string, body: string) => {
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
