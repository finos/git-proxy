import { Step } from '../../actions';
import { performance } from 'perf_hooks';

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
    this.startTime = performance.now();
    this.step.log(`${operation} started`);
  }

  mark(message: string): void {
    if (this.startTime > 0) {
      const elapsed = performance.now() - this.startTime;
      this.step.log(`${message}: ${elapsed.toFixed(2)}ms`);
    }
  }

  end(): void {
    if (this.startTime > 0) {
      const totalTime = performance.now() - this.startTime;
      this.step.log(`${this.operation} completed: ${totalTime.toFixed(2)}ms`);
      this.startTime = 0;
    }
  }
}
