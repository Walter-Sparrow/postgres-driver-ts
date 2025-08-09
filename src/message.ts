import { handleAuthenticationMessage } from "./auth.js";
import { PROTOCOL_VERSION } from "./constants.js";
import { Reader } from "./reader.js";
import { Writer } from "./writer.js";
import { Context } from "./context.js";
import { handleParameterStatusMessage } from "./parameter-status.js";
import { handleBackendKeyDataMessage } from "./backend-key-data.js";
import { handleReadyForQueryMessage } from "./ready-for-query.js";
import { handleErrorResponseMessage } from "./error-response.js";
import {
  handleDataRowMessage,
  handleRowDescriptionMessage,
} from "./row-description.js";
import { handleCommandCompleteMessage } from "./command-complete.js";

export enum BackendMessageType {
  CommandComplete = 67, // 'C'
  DataRow = 68, // 'D'
  ErrorResponse = 69, // 'E'
  BackendKeyData = 75, // 'K'
  Authentication = 82, // 'R'
  ParameterStatus = 83, // 'S'
  RowDescription = 84, // 'T'
  ReadyForQuery = 90, // 'Z'
}

export enum FrontendMessageType {
  Parse = 80, // 'P'
  Query = 81, // 'Q'
  Sync = 83, // 'S'
  Password = 112, // 'p'
}

export type MessageType = BackendMessageType | FrontendMessageType;

export interface PgMessage {
  type: MessageType;
  length: number;
  data: Buffer;
}

export function parsePgMessage(raw: Buffer): PgMessage {
  const reader = new Reader(raw);
  const type = reader.readUInt8();
  const length = reader.readUInt32BE();
  const data = reader.read(length - 4 /* length */);
  return { type, length: length + 1, data };
}

export function createPgMessage(type: MessageType, data?: Buffer): Buffer {
  const dataLength = data ? data.length : 0;
  const writer = new Writer(dataLength + 1 /* type */ + 4 /* length */);
  writer.writeUInt8(type);
  writer.writeUInt32BE(dataLength + 4 /* length */);
  if (data) writer.write(data);
  return writer.getBuffer();
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

  const length =
    4 /* length */ +
    4 /* protocol version */ +
    paramBuffer.length +
    1; /* null */

  const writer = new Writer(length);
  writer.writeUInt32BE(length);
  writer.writeUInt32BE(PROTOCOL_VERSION);
  writer.write(paramBuffer);
  writer.writeUInt8(0);
  return writer.getBuffer();
}

export function handlePgMessages(data: Buffer, context: Context) {
  let offset = 0;
  while (offset < data.length) {
    const message = parsePgMessage(data.subarray(offset));

    switch (message.type) {
      case BackendMessageType.Authentication:
        handleAuthenticationMessage(message, context);
        break;
      case BackendMessageType.ParameterStatus:
        handleParameterStatusMessage(message, context);
        break;
      case BackendMessageType.BackendKeyData:
        handleBackendKeyDataMessage(message, context);
        break;
      case BackendMessageType.ReadyForQuery:
        handleReadyForQueryMessage(message, context);
        break;
      case BackendMessageType.RowDescription:
        handleRowDescriptionMessage(message, context);
        break;
      case BackendMessageType.DataRow:
        handleDataRowMessage(message, context);
        break;
      case BackendMessageType.CommandComplete:
        handleCommandCompleteMessage(message, context);
        break;
      case BackendMessageType.ErrorResponse:
        handleErrorResponseMessage(message, context);
        break;
      default:
        console.log("Unknown message type", message.type);
    }

    offset += message.length;
  }
}
