/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Custom error classes for database operations
 * These provide type-safe error handling and better maintainability
 */

/**
 * Thrown when attempting to add an SSH key that is already in use by another user
 */
export class DuplicateSSHKeyError extends Error {
  constructor(public readonly existingUsername: string) {
    super(`SSH key already in use by user '${existingUsername}'`);
    this.name = 'DuplicateSSHKeyError';
    Object.setPrototypeOf(this, DuplicateSSHKeyError.prototype);
  }
}

/**
 * Thrown when a user is not found in the database
 */
export class UserNotFoundError extends Error {
  constructor(public readonly username: string) {
    super(`User not found`);
    this.name = 'UserNotFoundError';
    Object.setPrototypeOf(this, UserNotFoundError.prototype);
  }
}
