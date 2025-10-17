declare module 'passport-activedirectory' {
  import { Strategy as PassportStrategy } from 'passport';
  class Strategy extends PassportStrategy {
    constructor(options: any, verify: (...args: any[]) => void);
  }
  export = Strategy;
}
