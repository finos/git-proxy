import { Step } from '../../actions';

/**
 * Performance Timer
 *
 * Logs basic timing info for operations
 */
export class PerformanceTimer {
  private step: Step;
  private startTime: number = 0;
  private operation: string = '';

  constructor(step: Step) {
    this.step = step;
  }

  start(operation: string): void {
    this.operation = operation;
    this.startTime = Date.now();
    this.step.log(`${operation} started`);
  }

  mark(message: string): void {
    if (this.startTime > 0) {
      const elapsed = Date.now() - this.startTime;
      this.step.log(`${message}: ${elapsed}ms`);
    }
  }

  end(): void {
    if (this.startTime > 0) {
      const totalTime = Date.now() - this.startTime;
      this.step.log(`${this.operation} completed: ${totalTime}ms`);
      this.startTime = 0;
    }
  }
}
