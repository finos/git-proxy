import { PACKET_SIZE } from './constants';

/**
 * Parses the packet lines from a buffer into an array of strings.
 * Also returns the offset immediately following the parsed lines (including the flush packet).
 * @param {Buffer} buffer - The buffer containing the packet data.
 * @return {[string[], number]} An array containing the parsed lines and the offset after the last parsed line/flush packet.
 */
export const parsePacketLines = (buffer: Buffer): [string[], number] => {
  const lines: string[] = [];
  let offset = 0;

  while (offset + PACKET_SIZE <= buffer.length) {
    const lengthHex = buffer.toString('utf8', offset, offset + PACKET_SIZE);
    const length = Number(`0x${lengthHex}`);

    // Prevent non-hex characters from causing issues
    if (isNaN(length) || length < 0) {
      throw new Error(`Invalid packet line length ${lengthHex} at offset ${offset}`);
    }

    // length of 0 indicates flush packet (0000)
    if (length === 0) {
      offset += PACKET_SIZE; // Include length of the flush packet
      break;
    }

    // Make sure we don't read past the end of the buffer
    if (offset + length > buffer.length) {
      throw new Error(`Invalid packet line length ${lengthHex} at offset ${offset}`);
    }

    const line = buffer.toString('utf8', offset + PACKET_SIZE, offset + length);
    lines.push(line);
    offset += length; // Move offset to the start of the next line's length prefix
  }
  return [lines, offset];
};
