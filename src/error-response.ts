import { Context } from "./context.js";
import { PgMessage } from "./message.js";
import { Reader } from "./reader.js";

export enum ErrorCode {
  Severity = "S",
  SeverityOld = "V",
  Code = "C",
  Message = "M",
}

export interface Error {
  code: ErrorCode;
  message?: string;
}

export function handleErrorResponseMessage(
  message: PgMessage,
  context: Context
) {
  const errors: Error[] = [];
  const reader = new Reader(message.data);
  let code = reader.readUInt8();
  do {
    const message = reader.readNullTerminatedString().slice(0, -1);
    errors.push({ code: String.fromCharCode(code) as ErrorCode, message });

    code = reader.readUInt8();
  } while (code !== 0);

  context.eventEmitter.emit("errorResponse", errors);
  console.error("Error response", errors);
}
