/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
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

export const toClass = function <T, U>(obj: T, proto: U): U {
  const out = JSON.parse(JSON.stringify(obj));
  out.__proto__ = proto;
  return out as U;
};

export const trimTrailingDotGit = (str: string): string => {
  const target = '.git';
  if (str && str.endsWith(target)) {
    // extract string from 0 to the end minus the length of target
    return str.slice(0, -target.length);
  }
  return str;
};

export const trimPrefixRefsHeads = (str: string): string => {
  const target = 'refs/heads/';
  if (str.startsWith(target)) {
    // extract string from the end of the target to the end of str
    return str.slice(target.length);
  }
  return str;
};
