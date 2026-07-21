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

import { Response } from 'express';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  encodeSidebandChunk,
  encodePacketLine,
  encodeRejectionReportStatus,
  buildRejectionReportStatus,
  SidebandBand,
  SidebandProgressWriter,
  NOOP_PROGRESS_WRITER,
  createProgressWriter,
} from '../src/proxy/sideband';
import {
  FLUSH_PACKET,
  MAX_SIDEBAND_PAYLOAD_BYTES,
  SIDE_BAND_64K_CAPABILITY,
} from '../src/proxy/constants';
import * as config from '../src/config';
import { Action, RequestType, PushType } from '../src/proxy/actions';

const createMockRes = () => {
  const writes: Buffer[] = [];
  const res = {
    headersSent: false,
    writableEnded: false,
    status: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: Buffer | string) => {
      writes.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    }),
    end: vi.fn(),
  };
  return { res: res as unknown as Response, mocks: res, writes };
};

const pushAction = (overrides: Partial<Action> = {}): Action =>
  ({
    type: RequestType.PUSH,
    protocol: 'https',
    capabilities: ['report-status', SIDE_BAND_64K_CAPABILITY, 'agent=git/2.42.0'],
    ...overrides,
  }) as Action;

describe('encodeSidebandChunk', () => {
  it('should encode a small payload as a single pkt-line packet', () => {
    const packet = encodeSidebandChunk(SidebandBand.Progress, 'hello\n');

    // 4 length bytes + 1 band byte + 6 payload bytes = 11 = 0x000b
    expect(packet.length).toBe(11);
    expect(packet.subarray(0, 4).toString('ascii')).toBe('000b');
    expect(packet[4]).toBe(2);
    expect(packet.subarray(5).toString('utf8')).toBe('hello\n');
  });

  it('should encode band 1 and band 3 packets', () => {
    expect(encodeSidebandChunk(SidebandBand.Data, 'x')[4]).toBe(1);
    expect(encodeSidebandChunk(SidebandBand.Error, 'x')[4]).toBe(3);
  });

  it('should preserve multi-byte UTF-8 payloads', () => {
    const message = '✅ done';
    const packet = encodeSidebandChunk(SidebandBand.Progress, message);
    const expectedLength = 5 + Buffer.byteLength(message);

    expect(parseInt(packet.subarray(0, 4).toString('ascii'), 16)).toBe(expectedLength);
    expect(packet.subarray(5).toString('utf8')).toBe(message);
  });

  it('should fit a payload of exactly the maximum size in one packet', () => {
    const payload = Buffer.alloc(MAX_SIDEBAND_PAYLOAD_BYTES, 0x61);
    const packet = encodeSidebandChunk(SidebandBand.Progress, payload);

    expect(packet.length).toBe(4 + 1 + MAX_SIDEBAND_PAYLOAD_BYTES);
    expect(packet.subarray(0, 4).toString('ascii')).toBe('fff0'); // 65520
  });

  it('should split payloads larger than the maximum across multiple packets', () => {
    const payload = Buffer.alloc(MAX_SIDEBAND_PAYLOAD_BYTES + 10, 0x62);
    const packet = encodeSidebandChunk(SidebandBand.Progress, payload);

    // first packet: full sized
    expect(packet.subarray(0, 4).toString('ascii')).toBe('fff0');
    const secondPacket = packet.subarray(4 + 1 + MAX_SIDEBAND_PAYLOAD_BYTES);
    // second packet: 4 + 1 + 10 bytes = 15 = 0x000f
    expect(secondPacket.subarray(0, 4).toString('ascii')).toBe('000f');
    expect(secondPacket[4]).toBe(2);
    expect(secondPacket.subarray(5).toString('utf8')).toBe('b'.repeat(10));
  });
});

describe('encodePacketLine', () => {
  it('should prefix the payload with its 4-byte hex length', () => {
    const packet = encodePacketLine('unpack ok\n');

    // 4 length bytes + 10 payload bytes = 14 = 0x000e
    expect(packet.toString('utf8')).toBe('000eunpack ok\n');
  });
});

describe('encodeRejectionReportStatus', () => {
  it('should wrap unpack ok, ng lines and an inner flush in a band-1 packet', () => {
    const packet = encodeRejectionReportStatus(['refs/heads/main'], 'approval required');

    expect(packet[4]).toBe(SidebandBand.Data);
    const payload = packet.subarray(5).toString('utf8');
    expect(payload).toBe(
      '000eunpack ok\n' + '0029ng refs/heads/main approval required\n' + FLUSH_PACKET,
    );
  });

  it('should emit one ng line per ref', () => {
    const packet = encodeRejectionReportStatus(
      ['refs/heads/main', 'refs/tags/v1.0.0'],
      'rejected by GitProxy',
    );
    const payload = packet.subarray(5).toString('utf8');

    expect(payload).toContain('ng refs/heads/main rejected by GitProxy\n');
    expect(payload).toContain('ng refs/tags/v1.0.0 rejected by GitProxy\n');
    expect(payload.endsWith(FLUSH_PACKET)).toBe(true);
  });

  it('should sanitize multi-line reasons into a single line', () => {
    const packet = encodeRejectionReportStatus(['refs/heads/main'], 'first\nsecond\r\nthird');
    const payload = packet.subarray(5).toString('utf8');

    expect(payload).toContain('ng refs/heads/main first second third\n');
  });

  it('should fall back to a generic reason when the reason is empty', () => {
    const packet = encodeRejectionReportStatus(['refs/heads/main'], '\n');
    const payload = packet.subarray(5).toString('utf8');

    expect(payload).toContain('ng refs/heads/main rejected\n');
  });
});

describe('buildRejectionReportStatus', () => {
  const reportAction = (overrides: Partial<Action> = {}): Action =>
    pushAction({ branch: 'refs/heads/main', ...overrides });

  it('should build a report for a branch push with report-status and side-band-64k', () => {
    const report = buildRejectionReportStatus(reportAction(), 'approval required');

    expect(report).toBeInstanceOf(Buffer);
    expect(report!.subarray(5).toString('utf8')).toContain(
      'ng refs/heads/main approval required\n',
    );
  });

  it('should accept report-status-v2', () => {
    const report = buildRejectionReportStatus(
      reportAction({ capabilities: ['report-status-v2', SIDE_BAND_64K_CAPABILITY] }),
      'approval required',
    );

    expect(report).toBeInstanceOf(Buffer);
  });

  it('should reject all tag refs for a tag push', () => {
    const report = buildRejectionReportStatus(
      reportAction({ actionType: PushType.TAG, tags: ['refs/tags/v1.0.0', 'refs/tags/v1.0.1'] }),
      'rejected by GitProxy',
    );

    const payload = report!.subarray(5).toString('utf8');
    expect(payload).toContain('ng refs/tags/v1.0.0 rejected by GitProxy\n');
    expect(payload).toContain('ng refs/tags/v1.0.1 rejected by GitProxy\n');
  });

  it('should return undefined when the action is missing', () => {
    expect(buildRejectionReportStatus(undefined, 'reason')).toBeUndefined();
  });

  it('should return undefined when side-band-64k was not negotiated', () => {
    expect(
      buildRejectionReportStatus(reportAction({ capabilities: ['report-status'] }), 'reason'),
    ).toBeUndefined();
  });

  it('should return undefined when the client did not request a status report', () => {
    expect(
      buildRejectionReportStatus(
        reportAction({ capabilities: [SIDE_BAND_64K_CAPABILITY] }),
        'reason',
      ),
    ).toBeUndefined();
  });

  it('should return undefined when no refs are known', () => {
    expect(
      buildRejectionReportStatus(reportAction({ branch: undefined }), 'reason'),
    ).toBeUndefined();
    expect(
      buildRejectionReportStatus(
        reportAction({ actionType: PushType.TAG, branch: undefined, tags: [] }),
        'reason',
      ),
    ).toBeUndefined();
  });
});

describe('SidebandProgressWriter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should flush headers once and write band-2 packets', () => {
    const { res, mocks, writes } = createMockRes();
    const writer = new SidebandProgressWriter(res);

    writer.message('scanning for secrets...');
    writer.message('checking commit messages...');

    expect(mocks.status).toHaveBeenCalledExactlyOnceWith(200);
    expect(mocks.set).toHaveBeenCalledWith('content-type', 'application/x-git-receive-pack-result');
    expect(mocks.flushHeaders).toHaveBeenCalledOnce();
    expect(writes).toHaveLength(2);

    // eslint-disable-next-line no-control-regex
    expect(writes[0].toString('utf8')).toMatch(/^[0-9a-f]{4}\x02scanning for secrets\.\.\.\n$/);
    // eslint-disable-next-line no-control-regex
    expect(writes[1].toString('utf8')).toMatch(/^[0-9a-f]{4}\x02checking commit messages\.\.\.\n$/);
  });

  it('should not append a newline when the message already ends with one', () => {
    const { res, writes } = createMockRes();
    const writer = new SidebandProgressWriter(res);

    writer.message('already terminated\n');

    expect(writes[0].toString('utf8').endsWith('already terminated\n')).toBe(true);
    expect(writes[0].toString('utf8').endsWith('\n\n')).toBe(false);
  });

  it('should deactivate itself when a write fails', () => {
    const { res, mocks } = createMockRes();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.write.mockImplementation(() => {
      throw new Error('boom');
    });
    const writer = new SidebandProgressWriter(res);

    writer.message('first');
    expect(writer.active).toBe(false);

    writer.message('second');
    expect(mocks.write).toHaveBeenCalledOnce();
  });
});

describe('createProgressWriter', () => {
  beforeEach(() => {
    vi.spyOn(config, 'getSidebandProgressEnabled').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return an active writer for an HTTPS push with side-band-64k negotiated', () => {
    const { res } = createMockRes();
    const writer = createProgressWriter(res, pushAction());

    expect(writer.active).toBe(true);
    expect(writer).toBeInstanceOf(SidebandProgressWriter);
  });

  it('should return a no-op writer when the config flag is disabled', () => {
    vi.mocked(config.getSidebandProgressEnabled).mockReturnValue(false);
    const { res } = createMockRes();

    expect(createProgressWriter(res, pushAction())).toBe(NOOP_PROGRESS_WRITER);
  });

  it('should return a no-op writer for non-push actions', () => {
    const { res } = createMockRes();

    expect(createProgressWriter(res, pushAction({ type: RequestType.PULL }))).toBe(
      NOOP_PROGRESS_WRITER,
    );
  });

  it('should return a no-op writer for SSH pushes', () => {
    const { res } = createMockRes();

    expect(createProgressWriter(res, pushAction({ protocol: 'ssh' }))).toBe(NOOP_PROGRESS_WRITER);
  });

  it('should return a no-op writer when side-band-64k was not negotiated', () => {
    const { res } = createMockRes();

    expect(createProgressWriter(res, pushAction({ capabilities: ['report-status'] }))).toBe(
      NOOP_PROGRESS_WRITER,
    );
    expect(createProgressWriter(res, pushAction({ capabilities: undefined }))).toBe(
      NOOP_PROGRESS_WRITER,
    );
  });

  it('should return a no-op writer when the response is not usable for streaming', () => {
    const { res: startedRes, mocks } = createMockRes();
    mocks.headersSent = true;
    expect(createProgressWriter(startedRes, pushAction())).toBe(NOOP_PROGRESS_WRITER);

    // mock responses without streaming support (e.g. the SSH server's mock res)
    const mockRes = { send: () => {} } as unknown as Response;
    expect(createProgressWriter(mockRes, pushAction())).toBe(NOOP_PROGRESS_WRITER);

    expect(createProgressWriter(undefined as unknown as Response, pushAction())).toBe(
      NOOP_PROGRESS_WRITER,
    );
  });

  it('the no-op writer should discard messages without error', () => {
    expect(NOOP_PROGRESS_WRITER.active).toBe(false);
    expect(() => NOOP_PROGRESS_WRITER.message('ignored')).not.toThrow();
  });
});
