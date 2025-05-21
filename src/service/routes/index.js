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
const express = require('express');
const auth = require('./auth');
const push = require('./push');
const home = require('./home');
const repo = require('./repo');
const users = require('./users');
const healthcheck = require('./healthcheck');
const config = require('./config');
const router = new express.Router();

router.use('/api', home);
router.use('/api/auth', auth);
router.use('/api/v1/healthcheck', healthcheck);
router.use('/api/v1/push', push);
router.use('/api/v1/repo', repo);
router.use('/api/v1/user', users);
router.use('/api/v1/config', config);

module.exports = router;
