import { PROTOCOL_VERSION } from "./constants.js";

export enum MessageType {
  Authentication = 0x52, // 'R'
}

interface StartupMessagePayload {
  user: string;
  database: string;
}

export function createStartupMessage(options: StartupMessagePayload): Buffer {
  const paramBuffer = Buffer.concat(
    Object.entries(options).map(([key, value]) => {
      const keyBuffer = Buffer.from(key + "\0", "utf8");
      const valueBuffer = Buffer.from(value + "\0", "utf8");
      return Buffer.concat([keyBuffer, valueBuffer]);
    })
  );

  const length = 4 + 4 + paramBuffer.length + 1; // 4 for message type, 4 for length, and 1 for null terminator
  const buffer = Buffer.alloc(length);
  let offset = 0;
  buffer.writeUInt32BE(length, offset);
  offset += 4;

  buffer.writeUInt32BE(PROTOCOL_VERSION, 4);
  offset += 4;

  paramBuffer.copy(buffer, 8);
  offset += paramBuffer.length;

  buffer.writeUInt8(0, length - 1);

  return buffer;
}
