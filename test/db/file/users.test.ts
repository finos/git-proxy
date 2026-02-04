import { describe, it, expect, beforeEach } from 'vitest';
import * as dbUsers from '../../../src/db/file/users';
import { User, PublicKeyRecord } from '../../../src/db/types';

describe('db/file/users SSH Key Functions', () => {
  beforeEach(async () => {
    // Clear the database before each test
    const allUsers = await dbUsers.getUsers();
    for (const user of allUsers) {
      await dbUsers.deleteUser(user.username);
    }
  });

  describe('addPublicKey', () => {
    it('should add SSH key to user', async () => {
      const testUser: User = {
        username: 'testuser',
        password: 'password',
        email: 'test@example.com',
        publicKeys: [],
        gitAccount: '',
        admin: false,
      };

      await dbUsers.createUser(testUser);

      const publicKey: PublicKeyRecord = {
        key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest',
        fingerprint: 'SHA256:testfingerprint123',
        name: 'Test Key',
        addedAt: new Date().toISOString(),
      };

      await dbUsers.addPublicKey('testuser', publicKey);

      const updatedUser = await dbUsers.findUser('testuser');
      expect(updatedUser).toBeDefined();
      expect(updatedUser?.publicKeys).toHaveLength(1);
      expect(updatedUser?.publicKeys?.[0].fingerprint).toBe('SHA256:testfingerprint123');
    });

    it('should throw error when user not found', async () => {
      const publicKey: PublicKeyRecord = {
        key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest',
        fingerprint: 'SHA256:testfingerprint123',
        name: 'Test Key',
        addedAt: new Date().toISOString(),
      };

      await expect(dbUsers.addPublicKey('nonexistentuser', publicKey)).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw error when key already exists for same user', async () => {
      const testUser: User = {
        username: 'testuser',
        password: 'password',
        email: 'test@example.com',
        publicKeys: [],
        gitAccount: '',
        admin: false,
      };

      await dbUsers.createUser(testUser);

      const publicKey: PublicKeyRecord = {
        key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest',
        fingerprint: 'SHA256:testfingerprint123',
        name: 'Test Key',
        addedAt: new Date().toISOString(),
      };

      await dbUsers.addPublicKey('testuser', publicKey);

      // Try to add the same key again
      await expect(dbUsers.addPublicKey('testuser', publicKey)).rejects.toThrow(
        'SSH key already exists',
      );
    });

    it('should throw error when key exists for different user', async () => {
      const user1: User = {
        username: 'user1',
        password: 'password',
        email: 'user1@example.com',
        publicKeys: [],
        gitAccount: '',
        admin: false,
      };

      const user2: User = {
        username: 'user2',
        password: 'password',
        email: 'user2@example.com',
        publicKeys: [],
        gitAccount: '',
        admin: false,
      };

      await dbUsers.createUser(user1);
      await dbUsers.createUser(user2);

      const publicKey: PublicKeyRecord = {
        key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest',
        fingerprint: 'SHA256:testfingerprint123',
        name: 'Test Key',
        addedAt: new Date().toISOString(),
      };

      await dbUsers.addPublicKey('user1', publicKey);

      // Try to add the same key to user2
      await expect(dbUsers.addPublicKey('user2', publicKey)).rejects.toThrow();
    });

    it('should reject adding key when fingerprint already exists', async () => {
      const testUser: User = {
        username: 'testuser',
        password: 'password',
        email: 'test@example.com',
        publicKeys: [],
        gitAccount: '',
        admin: false,
      };

      await dbUsers.createUser(testUser);

      const publicKey1: PublicKeyRecord = {
        key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest1',
        fingerprint: 'SHA256:testfingerprint123',
        name: 'Test Key 1',
        addedAt: new Date().toISOString(),
      };

      // Same key content (same fingerprint means same key in reality)
      const publicKey2: PublicKeyRecord = {
        key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest1',
        fingerprint: 'SHA256:testfingerprint123',
        name: 'Test Key 2 (different name)',
        addedAt: new Date().toISOString(),
      };

      await dbUsers.addPublicKey('testuser', publicKey1);

      // Should reject because fingerprint already exists
      await expect(dbUsers.addPublicKey('testuser', publicKey2)).rejects.toThrow(
        'SSH key already exists',
      );
    });

    it('should initialize publicKeys array if not present', async () => {
      const testUser: User = {
        username: 'testuser',
        password: 'password',
        email: 'test@example.com',
        // No publicKeys field
      } as any;

      await dbUsers.createUser(testUser);

      const publicKey: PublicKeyRecord = {
        key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest',
        fingerprint: 'SHA256:testfingerprint123',
        name: 'Test Key',
        addedAt: new Date().toISOString(),
      };

      await dbUsers.addPublicKey('testuser', publicKey);

      const updatedUser = await dbUsers.findUser('testuser');
      expect(updatedUser?.publicKeys).toBeDefined();
      expect(updatedUser?.publicKeys).toHaveLength(1);
    });
  });

  describe('removePublicKey', () => {
    it('should remove SSH key from user', async () => {
      const testUser: User = {
        username: 'testuser',
        password: 'password',
        email: 'test@example.com',
        publicKeys: [
          {
            key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest',
            fingerprint: 'SHA256:testfingerprint123',
            name: 'Test Key',
            addedAt: new Date().toISOString(),
          },
        ],
        gitAccount: '',
        admin: false,
      };

      await dbUsers.createUser(testUser);

      await dbUsers.removePublicKey('testuser', 'SHA256:testfingerprint123');

      const updatedUser = await dbUsers.findUser('testuser');
      expect(updatedUser?.publicKeys).toHaveLength(0);
    });

    it('should throw error when user not found', async () => {
      await expect(
        dbUsers.removePublicKey('nonexistentuser', 'SHA256:testfingerprint123'),
      ).rejects.toThrow('User not found');
    });

    it('should handle removing key when publicKeys array is undefined', async () => {
      const testUser: User = {
        username: 'testuser',
        password: 'password',
        email: 'test@example.com',
        // No publicKeys field
      } as any;

      await dbUsers.createUser(testUser);

      // Should not throw, just resolve
      await dbUsers.removePublicKey('testuser', 'SHA256:nonexistent');

      const user = await dbUsers.findUser('testuser');
      expect(user?.publicKeys).toEqual([]);
    });

    it('should only remove the specified key', async () => {
      const testUser: User = {
        username: 'testuser',
        password: 'password',
        email: 'test@example.com',
        publicKeys: [
          {
            key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest1',
            fingerprint: 'SHA256:fingerprint1',
            name: 'Key 1',
            addedAt: new Date().toISOString(),
          },
          {
            key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest2',
            fingerprint: 'SHA256:fingerprint2',
            name: 'Key 2',
            addedAt: new Date().toISOString(),
          },
        ],
        gitAccount: '',
        admin: false,
      };

      await dbUsers.createUser(testUser);

      await dbUsers.removePublicKey('testuser', 'SHA256:fingerprint1');

      const updatedUser = await dbUsers.findUser('testuser');
      expect(updatedUser?.publicKeys).toHaveLength(1);
      expect(updatedUser?.publicKeys?.[0].fingerprint).toBe('SHA256:fingerprint2');
    });

    it('should handle removing non-existent key gracefully', async () => {
      const testUser: User = {
        username: 'testuser',
        password: 'password',
        email: 'test@example.com',
        publicKeys: [
          {
            key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest',
            fingerprint: 'SHA256:testfingerprint123',
            name: 'Test Key',
            addedAt: new Date().toISOString(),
          },
        ],
        gitAccount: '',
        admin: false,
      };

      await dbUsers.createUser(testUser);

      await dbUsers.removePublicKey('testuser', 'SHA256:nonexistent');

      const updatedUser = await dbUsers.findUser('testuser');
      expect(updatedUser?.publicKeys).toHaveLength(1);
    });
  });

  describe('findUserBySSHKey', () => {
    it('should find user by SSH key', async () => {
      const testUser: User = {
        username: 'testuser',
        password: 'password',
        email: 'test@example.com',
        publicKeys: [
          {
            key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest',
            fingerprint: 'SHA256:testfingerprint123',
            name: 'Test Key',
            addedAt: new Date().toISOString(),
          },
        ],
        gitAccount: '',
        admin: false,
      };

      await dbUsers.createUser(testUser);

      const foundUser = await dbUsers.findUserBySSHKey('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest');

      expect(foundUser).toBeDefined();
      expect(foundUser?.username).toBe('testuser');
    });

    it('should return null when SSH key not found', async () => {
      const foundUser = await dbUsers.findUserBySSHKey(
        'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINonExistent',
      );

      expect(foundUser).toBeNull();
    });

    it('should find user with multiple keys by specific key', async () => {
      const testUser: User = {
        username: 'testuser',
        password: 'password',
        email: 'test@example.com',
        publicKeys: [
          {
            key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest1',
            fingerprint: 'SHA256:fingerprint1',
            name: 'Key 1',
            addedAt: new Date().toISOString(),
          },
          {
            key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest2',
            fingerprint: 'SHA256:fingerprint2',
            name: 'Key 2',
            addedAt: new Date().toISOString(),
          },
        ],
        gitAccount: '',
        admin: false,
      };

      await dbUsers.createUser(testUser);

      const foundUser = await dbUsers.findUserBySSHKey(
        'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest2',
      );

      expect(foundUser).toBeDefined();
      expect(foundUser?.username).toBe('testuser');
    });
  });

  describe('getPublicKeys', () => {
    it('should return all public keys for user', async () => {
      const testUser: User = {
        username: 'testuser',
        password: 'password',
        email: 'test@example.com',
        publicKeys: [
          {
            key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest1',
            fingerprint: 'SHA256:fingerprint1',
            name: 'Key 1',
            addedAt: '2024-01-01T00:00:00Z',
          },
          {
            key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest2',
            fingerprint: 'SHA256:fingerprint2',
            name: 'Key 2',
            addedAt: '2024-01-02T00:00:00Z',
          },
        ],
        gitAccount: '',
        admin: false,
      };

      await dbUsers.createUser(testUser);

      const keys = await dbUsers.getPublicKeys('testuser');

      expect(keys).toHaveLength(2);
      expect(keys[0].fingerprint).toBe('SHA256:fingerprint1');
      expect(keys[1].fingerprint).toBe('SHA256:fingerprint2');
    });

    it('should return empty array when user has no keys', async () => {
      const testUser: User = {
        username: 'testuser',
        password: 'password',
        email: 'test@example.com',
        publicKeys: [],
        gitAccount: '',
        admin: false,
      };

      await dbUsers.createUser(testUser);

      const keys = await dbUsers.getPublicKeys('testuser');

      expect(keys).toEqual([]);
    });

    it('should throw error when user not found', async () => {
      await expect(dbUsers.getPublicKeys('nonexistentuser')).rejects.toThrow('User not found');
    });

    it('should return empty array when publicKeys field is undefined', async () => {
      const testUser: User = {
        username: 'testuser',
        password: 'password',
        email: 'test@example.com',
        // No publicKeys field
      } as any;

      await dbUsers.createUser(testUser);

      const keys = await dbUsers.getPublicKeys('testuser');

      expect(keys).toEqual([]);
    });
  });
});
