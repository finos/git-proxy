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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('local auth defaults', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('creates default local users in production and marks them for password change', async () => {
    process.env.NODE_ENV = 'production';

    const dbStub = {
      findUser: vi.fn().mockResolvedValue(null),
      createUser: vi.fn().mockResolvedValue(undefined),
    };
    vi.doMock('../../../src/db', () => dbStub);

    const { createDefaultAdmin } = await import('../../../src/service/passport/local');
    await createDefaultAdmin();

    expect(dbStub.findUser).toHaveBeenCalledWith('admin');
    expect(dbStub.findUser).toHaveBeenCalledWith('user');
    expect(dbStub.createUser).toHaveBeenCalledWith(
      'admin',
      'admin',
      'admin@place.com',
      'none',
      true,
      '',
      true,
    );
    expect(dbStub.createUser).toHaveBeenCalledWith(
      'user',
      'user',
      'user@place.com',
      'none',
      false,
      '',
      true,
    );
  });

  it('creates default local users outside production when missing', async () => {
    process.env.NODE_ENV = 'test';

    const dbStub = {
      findUser: vi.fn().mockResolvedValue(null),
      createUser: vi.fn().mockResolvedValue(undefined),
    };
    vi.doMock('../../../src/db', () => dbStub);

    const { createDefaultAdmin } = await import('../../../src/service/passport/local');
    await createDefaultAdmin();

    expect(dbStub.findUser).toHaveBeenCalledWith('admin');
    expect(dbStub.findUser).toHaveBeenCalledWith('user');
    expect(dbStub.createUser).toHaveBeenCalledWith(
      'admin',
      'admin',
      'admin@place.com',
      'none',
      true,
      '',
      false,
    );
    expect(dbStub.createUser).toHaveBeenCalledWith(
      'user',
      'user',
      'user@place.com',
      'none',
      false,
      '',
      false,
    );
  });
});

describe('local auth login hardening', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let verifyCallback:
    | ((
        username: string,
        password: string,
        done: (err: unknown, user?: unknown, info?: unknown) => void,
      ) => Promise<void>)
    | undefined;

  beforeEach(() => {
    vi.resetModules();
    verifyCallback = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('marks default-credential logins for password change in production', async () => {
    process.env.NODE_ENV = 'production';

    vi.doMock('bcryptjs', () => ({
      default: {
        compare: vi.fn().mockResolvedValue(true),
      },
    }));

    const dbStub = {
      findUser: vi.fn().mockResolvedValue({
        username: 'admin',
        password: 'hashed-admin',
        email: 'admin@place.com',
        gitAccount: 'none',
        admin: true,
        mustChangePassword: false,
      }),
      createUser: vi.fn(),
      updateUser: vi.fn().mockResolvedValue(undefined),
    };
    const passportStub = {
      use: vi.fn(),
      serializeUser: vi.fn(),
      deserializeUser: vi.fn(),
    };

    vi.doMock('../../../src/db', () => dbStub);
    vi.doMock('passport-local', () => ({
      Strategy: class {
        constructor(
          callback: (
            username: string,
            password: string,
            done: (err: unknown, user?: unknown, info?: unknown) => void,
          ) => Promise<void>,
        ) {
          verifyCallback = callback;
        }
      },
    }));

    const { configure } = await import('../../../src/service/passport/local');
    await configure(passportStub as any);

    expect(verifyCallback).toBeDefined();
    const done = vi.fn();
    await verifyCallback!('admin', 'admin', done);

    expect(dbStub.findUser).toHaveBeenCalledWith('admin');
    expect(dbStub.updateUser).toHaveBeenCalledWith({
      username: 'admin',
      mustChangePassword: true,
    });
    expect(done).toHaveBeenCalledTimes(1);
    const [_err, user, info] = done.mock.calls[0];
    expect(info).toBeUndefined();
    expect((user as { mustChangePassword?: boolean }).mustChangePassword).toBe(true);
  });
});
