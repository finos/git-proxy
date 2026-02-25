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
