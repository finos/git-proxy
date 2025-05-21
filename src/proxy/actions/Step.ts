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
import { v4 as uuidv4 } from "uuid";

/** Class representing a Push Step. */
class Step {
  id: string;
  stepName: string;
  content: any;
  error: boolean;
  errorMessage: string | null;
  blocked: boolean;
  blockedMessage: string | null;
  logs: string[] = [];

  constructor(
    stepName: string,
    error: boolean = false,
    errorMessage: string | null = null,
    blocked: boolean = false,
    blockedMessage: string | null = null,
    content: any = null
  ) {
    this.id = uuidv4();
    this.stepName = stepName;
    this.content = content;
    this.error = error;
    this.errorMessage = errorMessage;
    this.blocked = blocked;
    this.blockedMessage = blockedMessage;
  }

  setError(message: string): void {
    this.error = true;
    this.errorMessage = message;
    this.log(message);
  }

  setContent(content: any): void {
    this.log("setting content");
    this.content = content;
  }

  setAsyncBlock(message: string): void {
    this.log("setting blocked");
    this.blocked = true;
    this.blockedMessage = message;
  }

  log(message: string): void {
    const m = `${this.stepName} - ${message}`;
    this.logs.push(m);
    console.info(m);
  }
}

export { Step };
