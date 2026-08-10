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

import { Action, RequestType, PushType } from './actions';
import { getSidebandProgressEnabled } from '../config';
import {
  FLUSH_PACKET,
  MAX_SIDEBAND_PAYLOAD_BYTES,
  REPORT_STATUS_CAPABILITIES,
  SIDE_BAND_64K_CAPABILITY,
} from './constants';

/** Sideband channel numbers - see https://git-scm.com/docs/protocol-common */
export enum SidebandBand {
  /** Pack data or report-status payload */
  Data = 1,
  /** Progress messages, displayed by the client as "remote: ..." */
  Progress = 2,
  /** Fatal error message */
  Error = 3,
}

/**
 * Encode a payload as one or more sideband pkt-line packets on the given band.
 * Payloads larger than the side-band-64k limit are split across packets.
 * @param {SidebandBand} band The sideband channel to write to.
 * @param {string | Buffer} payload The payload to encode (strings are UTF-8 encoded).
 * @return {Buffer} The encoded packet(s), ready to write to the response stream.
 */
export const encodeSidebandChunk = (band: SidebandBand, payload: string | Buffer): Buffer => {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
  const packets: Buffer[] = [];
  let offset = 0;

  do {
    const slice = data.subarray(offset, offset + MAX_SIDEBAND_PAYLOAD_BYTES);
    const length = (4 + 1 + slice.length).toString(16).padStart(4, '0');
    packets.push(Buffer.from(length, 'ascii'), Buffer.from([band]), slice);
    offset += MAX_SIDEBAND_PAYLOAD_BYTES;
  } while (offset < data.length);

  return Buffer.concat(packets);
};

/**
 * Encode a single git pkt-line (4 hex length bytes followed by the payload).
 * @param {string} line The line to encode (should include its trailing newline).
 * @return {Buffer} The encoded pkt-line.
 */
export const encodePacketLine = (line: string): Buffer => {
  const data = Buffer.from(line, 'utf8');
  const length = (4 + data.length).toString(16).padStart(4, '0');
  return Buffer.concat([Buffer.from(length, 'ascii'), data]);
};

/**
 * Encode a synthesized receive-pack report-status that rejects every pushed
 * ref, wrapped in sideband band-1 packets to provide status report
 *
 * Completing the report-status exchange is what prevents the git client from
 * printing "fatal: the remote end hung up unexpectedly" when the proxy ends
 * the session without contacting upstream. Instead the client shows a normal
 * "! [remote rejected] <ref> (<reason>)" line.
 *
 * See https://git-scm.com/docs/pack-protocol#_report_status for more details
 * @param {string[]} refs The refs the client attempted to update.
 * @param {string} reason Short single-line reason shown by git in parentheses.
 * @return {Buffer} Band-1 packet(s) carrying the report-status.
 */
export const encodeRejectionReportStatus = (refs: string[], reason: string): Buffer => {
  const safeReason = reason.replace(/[\0\r\n]+/g, ' ').trim() || 'rejected';
  const report = Buffer.concat([
    encodePacketLine('unpack ok\n'),
    ...refs.map((ref) => encodePacketLine(`ng ${ref} ${safeReason}\n`)),
    Buffer.from(FLUSH_PACKET, 'ascii'),
  ]);
  return encodeSidebandChunk(SidebandBand.Data, report);
};

/**
 * Build the synthesized report-status for a blocked/rejected push, or
 * undefined when it cannot (or should not) be produced
 * @param {Action | undefined} action The push action (undefined if chain never ran)
 * @param {string} reason Short single-line reason shown by git in parentheses.
 * @return {Buffer | undefined} Band-1 packet(s) carrying the report, or undefined.
 */
export const buildRejectionReportStatus = (
  action: Action | undefined,
  reason: string,
): Buffer | undefined => {
  if (!action) {
    return undefined;
  }
  const capabilities = action.capabilities;
  if (!capabilities?.includes(SIDE_BAND_64K_CAPABILITY)) {
    return undefined;
  }
  if (!capabilities.some((cap) => REPORT_STATUS_CAPABILITIES.includes(cap))) {
    return undefined;
  }

  const refs =
    action.actionType === PushType.TAG ? (action.tags ?? []) : action.branch ? [action.branch] : [];
  if (refs.length === 0) {
    return undefined;
  }

  return encodeRejectionReportStatus(refs, reason);
};

/**
 * Writer used by the push chain to stream per-step progress messages to the
 * git client's terminal while validation runs.
 */
export interface ProgressWriter {
  /** Whether messages are currently being streamed to the client. */
  readonly active: boolean;
  /**
   * Stream a progress message (band 2) to the client. A trailing newline is
   * appended when missing.
   * @param {string} text The message to display in the client terminal.
   */
  message(text: string): void;
}

/** Progress writer that discards all messages when streaming not available */
export const NOOP_PROGRESS_WRITER: ProgressWriter = Object.freeze({
  active: false,
  message: () => {},
});

/**
 * Streams sideband band-2 progress messages over an HTTP response.
 *
 * The response headers are flushed lazily on the first message, switching the
 * response to chunked transfer encoding. Once started, the response must be
 * finished as a sideband stream (either by piping the upstream receive-pack
 * result through or by writing a final message followed by a flush packet).
 */
export class SidebandProgressWriter implements ProgressWriter {
  active = true;
  private started = false;

  /**
   * @param {Response} res The HTTP response to stream progress messages to.
   */
  constructor(private readonly res: Response) {}

  /**
   * Send response headers and switch to chunked streaming, once.
   */
  private start(): void {
    if (this.started) {
      return;
    }
    this.res.status(200);
    this.res.set('content-type', 'application/x-git-receive-pack-result');
    this.res.set('expires', 'Fri, 01 Jan 1980 00:00:00 GMT');
    this.res.set('pragma', 'no-cache');
    this.res.set('cache-control', 'no-cache, max-age=0, must-revalidate');
    this.res.set('vary', 'Accept-Encoding');
    this.res.set('x-frame-options', 'DENY');
    this.res.flushHeaders();
    this.started = true;
  }

  /**
   * Stream a progress message (band 2) to the client.
   * @param {string} text The message to display in the client terminal.
   */
  message(text: string): void {
    if (!this.active) {
      return;
    }
    try {
      this.start();
      const payload = text.endsWith('\n') ? text : `${text}\n`;
      this.res.write(encodeSidebandChunk(SidebandBand.Progress, payload));
    } catch (err: unknown) {
      console.error(`Failed to write sideband progress message: ${err}`);
      this.active = false;
    }
  }
}

/**
 * Create a progress writer for the current request, or a no-op writer when
 * streaming is not possible
 * @param {Response} res The HTTP response associated with the push.
 * @param {Action} action The parsed push action (capabilities must be populated).
 * @return {ProgressWriter} An active or no-op progress writer.
 */
export const createProgressWriter = (res: Response, action: Action): ProgressWriter => {
  if (!getSidebandProgressEnabled()) {
    return NOOP_PROGRESS_WRITER;
  }
  if (action.type !== RequestType.PUSH || action.protocol !== 'https') {
    return NOOP_PROGRESS_WRITER;
  }
  if (!action.capabilities?.includes(SIDE_BAND_64K_CAPABILITY)) {
    return NOOP_PROGRESS_WRITER;
  }
  if (
    !res ||
    typeof res.flushHeaders !== 'function' ||
    typeof res.write !== 'function' ||
    res.headersSent ||
    res.writableEnded
  ) {
    return NOOP_PROGRESS_WRITER;
  }
  return new SidebandProgressWriter(res);
};
