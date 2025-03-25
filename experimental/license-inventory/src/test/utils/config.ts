export const config = {
  Memory: typeof process.env.MONGOMS_SYSTEM_BINARY === 'string',
  IP: '127.0.0.1',
  Port: '27017',
  Database: 'testdb',
};
