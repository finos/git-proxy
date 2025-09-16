const { expect } = require('chai');

// Helper to reload the module fresh each time
function loadApiBase() {
  delete require.cache[require.resolve('../../src/ui/apiBase')];
  return require('../../src/ui/apiBase');
}

describe('apiBase', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.VITE_API_URI;
    delete process.env.VITE_API_URI;
    delete require.cache[require.resolve('../../src/ui/apiBase')];
  });

  afterEach(() => {
    if (typeof originalEnv === 'undefined') {
      delete process.env.VITE_API_URI;
    } else {
      process.env.VITE_API_URI = originalEnv;
    }
    delete require.cache[require.resolve('../../src/ui/apiBase')];
  });

  it('uses empty string when VITE_API_URI is not set', () => {
    const { API_BASE } = loadApiBase();
    expect(API_BASE).to.equal('');
  });

  it('returns the exact value when no trailing slash', () => {
    process.env.VITE_API_URI = 'https://example.com';
    const { API_BASE } = loadApiBase();
    expect(API_BASE).to.equal('https://example.com');
  });

  it('strips trailing slashes from VITE_API_URI', () => {
    process.env.VITE_API_URI = 'https://example.com////';
    const { API_BASE } = loadApiBase();
    expect(API_BASE).to.equal('https://example.com');
  });
});
