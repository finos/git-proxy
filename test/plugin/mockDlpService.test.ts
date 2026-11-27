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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type MockDlpService = typeof import('../../plugins/git-proxy-plugin-samples/mockDlpService');

const SERVICE = '../../plugins/git-proxy-plugin-samples/mockDlpService.ts';

const pinRandom = (...draws: number[]) =>
  vi.spyOn(Math, 'random').mockImplementation(() => draws.shift() ?? 0);

describe('mock DLP service sample', () => {
  let service: MockDlpService;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.resetModules();
    service = await import(SERVICE);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('submits a new scan that settles with its verdict after the planned delay', async () => {
    pinRandom(0, 0, 0); // approve, short bucket, minimum delay
    const { scan, reattached } = service.submitScan('push-1', 42);

    expect(reattached).toBe(false);
    expect(scan.id).toMatch(/^dlp-push-1-\d+$/);
    expect(scan.settledAt).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1999);
    expect(scan.settledAt).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);

    await expect(scan.result).resolves.toEqual({ approved: true });
    expect(scan.settledAt! - scan.submittedAt).toBe(2000);
  });

  it('reattaches a push to its pending scan without starting another', () => {
    const random = pinRandom(0, 0, 0);
    const first = service.submitScan('push-1', 42);
    const second = service.submitScan('push-1', 42);

    expect(second.reattached).toBe(true);
    expect(second.scan).toBe(first.scan);
    expect(random).toHaveBeenCalledTimes(3);
  });

  it('keeps settled scans until they are acknowledged', async () => {
    pinRandom(0, 0, 0);
    const { scan } = service.submitScan('push-1', 42);
    await vi.advanceTimersByTimeAsync(2000);

    expect(service.submitScan('push-1', 42)).toEqual({ scan, reattached: true });

    service.acknowledgeScan('push-1', scan);
    const next = service.submitScan('push-1', 42);
    expect(next.reattached).toBe(false);
    expect(next.scan).not.toBe(scan);
  });

  it('ignores an acknowledgement for a scan that is no longer current', async () => {
    pinRandom(0, 0, 0, 0, 0, 0);
    const { scan: stale } = service.submitScan('push-1', 42);
    service.acknowledgeScan('push-1', stale);
    const { scan: current } = service.submitScan('push-1', 42);

    service.acknowledgeScan('push-1', stale);

    expect(service.submitScan('push-1', 42).scan).toBe(current);
  });

  it('tracks scans per push', () => {
    pinRandom(0, 0, 0, 0, 0, 0);
    const a = service.submitScan('push-a', 1);
    const b = service.submitScan('push-b', 1);

    expect(a.scan).not.toBe(b.scan);
    expect(b.reattached).toBe(false);
  });

  it.each([
    [0, 'Contains sensitive data'],
    [0.34, 'Internal hostname detected'],
    [0.99, 'Personal email address detected'],
  ])('rejects with a reason picked by the random draw (%s)', async (draw, reason) => {
    pinRandom(0.5, draw, 0, 0);
    const { scan } = service.submitScan('push-1', 42);

    await vi.advanceTimersByTimeAsync(2000);

    await expect(scan.result).resolves.toEqual({ approved: false, reason });
  });

  it.each([
    ['short', 0, 0, 2000],
    ['short', 0.49, 0.999, 29972],
    ['long', 0.5, 0, 60000],
    ['long', 0.5, 0.999, 599460],
  ])('plans %s scans within their range (bucket %s, delay %s)', async (_label, bucket, pos, ms) => {
    pinRandom(0, bucket, pos);
    const { scan } = service.submitScan('push-1', 42);

    await vi.advanceTimersByTimeAsync(ms - 1);
    expect(scan.settledAt).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(scan.settledAt! - scan.submittedAt).toBe(ms);
  });

  it('does not keep the process alive for pending scans', () => {
    vi.useRealTimers();
    pinRandom(0, 0.9, 0.5);
    const { scan } = service.submitScan('push-1', 42);
    const { timer } = scan as typeof scan & { timer: NodeJS.Timeout };

    expect(timer.hasRef()).toBe(false);
    clearTimeout(timer);
  });
});
