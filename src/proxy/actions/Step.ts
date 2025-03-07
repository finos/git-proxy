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
