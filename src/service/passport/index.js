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
const local = require('./local');
const activeDirectory = require('./activeDirectory');
const oidc = require('./oidc');
const config = require('../../config');
const authenticationConfig = config.getAuthentication();
let _passport;

const configure = async () => {
  const type = authenticationConfig.type.toLowerCase();

  switch (type) {
    case 'activedirectory':
      _passport = await activeDirectory.configure();
      break;
    case 'local':
      _passport = await local.configure();
      break;
    case 'openidconnect':
      _passport = await oidc.configure();
      break;
    default:
      throw Error(`uknown authentication type ${type}`);
  }
  if (!_passport.type) {
    _passport.type = type;
  }
  return _passport;
};

module.exports.configure = configure;
module.exports.getPassport = () => {
  return _passport;
};
