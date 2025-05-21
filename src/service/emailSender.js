/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.    
 */
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
