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

const DEFAULT_APPROVAL_RATE = 0.5;

const REJECTION_REASONS = [
  'Contains sensitive data',
  'Internal hostname detected',
  'Personal email address detected',
];

export type Verdict = { approved: true } | { approved: false; reason: string };

export interface DlpScan {
  id: string;
  submittedAt: number;
  settledAt?: number;
  result: Promise<Verdict>;
}

interface StoredScan extends DlpScan {
  timer: ReturnType<typeof setTimeout>;
}

const scans = new Map<string, StoredScan>();

export function submitScan(pushId: string, bytes: number): { scan: DlpScan; reattached: boolean } {
  const existing = scans.get(pushId);
  if (existing) {
    trace(`Reattached push ${pushId} to existing scan ${existing.id}`);
    return { scan: existing, reattached: true };
  }

  const verdict = getRandomVerdict();
  const delayMs = getRandomDelayMs();
  const id = `dlp-${pushId}-${Date.now()}`;
  let timer!: ReturnType<typeof setTimeout>;
  const submittedAt = Date.now();
  const result = new Promise<Verdict>((resolve) => {
    timer = setTimeout(() => {
      scan.settledAt = Date.now();
      trace(`Scan ${id} finished with verdict ${describeVerdict(verdict)}`);
      resolve(verdict);
    }, delayMs);
  });

  timer.unref?.();

  const scan: StoredScan = { id, submittedAt, timer, result };
  scans.set(pushId, scan);
  trace(
    `Submitted scan ${id} for push ${pushId} with ${bytes} bytes. Expected result: ${describeVerdict(verdict)}, planned delay: ${delayMs}ms`,
  );
  return { scan, reattached: false };
}

export function acknowledgeScan(pushId: string, scan: DlpScan) {
  if (scans.get(pushId) === scan) {
    scans.delete(pushId);
  }
}

function getRandomVerdict(): Verdict {
  if (Math.random() < DEFAULT_APPROVAL_RATE) {
    return { approved: true };
  }
  const reason = REJECTION_REASONS[Math.floor(Math.random() * REJECTION_REASONS.length)];
  return { approved: false, reason };
}

function getRandomDelayMs(): number {
  return Math.random() < 0.5
    ? Math.round(randomBetween(2 * 1000, 30 * 1000))
    : Math.round(randomBetween(60 * 1000, 10 * 60 * 1000));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

const describeVerdict = (verdict: Verdict): string =>
  verdict.approved ? 'approved' : `rejected: ${verdict.reason}`;

const trace = (message: string) =>
  console.log(`[MockDlpService] ${new Date().toISOString()} ${message}`);
