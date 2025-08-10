import { FormatCode, ObjectId } from "./constants.js";
import { Context } from "./context.js";
import { createPgMessage, FrontendMessageType, PgMessage } from "./message.js";
import { Writer } from "./writer.js";

export interface ParseOptions {
  statementName?: string | null;
  query: string;
  paramTypes: ObjectId[];
}

export function createParseMessage(options: ParseOptions): Buffer {
  const nameBuf = Buffer.from((options.statementName || "") + "\0", "utf8");
  const queryBuf = Buffer.from(options.query + "\0", "utf8");

  const length =
    nameBuf.byteLength +
    queryBuf.byteLength +
    2 /* count */ +
    4 /* object id */ * options.paramTypes.length;
  const writer = new Writer(length);
  writer.write(nameBuf);
  writer.write(queryBuf);
  writer.writeUInt16BE(options.paramTypes.length);
  options.paramTypes.forEach((paramType) => writer.writeUInt32BE(paramType));
  return createPgMessage(FrontendMessageType.Parse, writer.getBuffer());
}

export function handleParseCompleteMessage(_msg: PgMessage, _context: Context) {
  console.log("Parse complete");
}

export interface BindOptions {
  portalName?: string | null;
  statementName?: string | null;
  paramFormatCodes: FormatCode[]; // empty will use text for all, one will apply to all
  paramValues: Buffer[];
  resultFormatCodes: FormatCode[]; // empty will use text for all, one will apply to all
}

export function createBindMessage(options: BindOptions): Buffer {
  const portalNameBuf = Buffer.from((options.portalName || "") + "\0", "utf8");
  const statementNameBuf = Buffer.from(
    (options.statementName || "") + "\0",
    "utf8"
  );

  let length =
    portalNameBuf.byteLength +
    statementNameBuf.byteLength +
    2 /* count */ +
    2 /* format code */ * options.paramFormatCodes.length +
    2; /* params count */

  options.paramValues.forEach((paramValue) => {
    length += 4 /* length */;
    length += paramValue.byteLength;
  });

  length +=
    2 /* result column count */ +
    2 /* format code */ * options.resultFormatCodes.length;

  const writer = new Writer(length);
  writer.write(portalNameBuf);
  writer.write(statementNameBuf);

  writer.writeUInt16BE(options.paramFormatCodes.length);
  options.paramFormatCodes.forEach((formatCode) =>
    writer.writeUInt16BE(formatCode)
  );

  writer.writeUInt16BE(options.paramValues.length);
  options.paramValues.forEach((paramValue) => {
    const bufLength = paramValue.byteLength === 0 ? -1 : paramValue.byteLength;
    writer.writeUInt32BE(bufLength);
    writer.write(paramValue); // TODO(ilya): handle format code
  });

  writer.writeUInt16BE(options.resultFormatCodes.length);
  options.resultFormatCodes.forEach((formatCode) =>
    writer.writeUInt16BE(formatCode)
  );

  return createPgMessage(FrontendMessageType.Bind, writer.getBuffer());
}

export function handleBindCompleteMessage(
  _message: PgMessage,
  _context: Context
) {
  console.log("Bind complete");
}

export interface DescribeOptions {
  subject: "portal" | "statement";
  name?: string | null;
}

export function createDescribeMessage(options: DescribeOptions): Buffer {
  const nameBuf = Buffer.from((options.name || "") + "\0", "utf8");

  const length = 1 /* subject */ + nameBuf.byteLength;
  const writer = new Writer(length);
  writer.writeUInt8(
    options.subject === "portal" ? "P".charCodeAt(0) : "S".charCodeAt(0)
  );
  writer.write(nameBuf);

  return createPgMessage(FrontendMessageType.Describe, writer.getBuffer());
}

export interface ExecuteOptions {
  portalName?: string | null;
  maxRows?: number; // 0 is a default and will act as no limit
}

export function createExecuteMessage(options: ExecuteOptions = {}): Buffer {
  const portalNameBuf = Buffer.from((options.portalName || "") + "\0", "utf8");
  const maxRows = options.maxRows || 0;

  const length = portalNameBuf.byteLength + 4; /* max rows */
  const writer = new Writer(length);
  writer.write(portalNameBuf);
  writer.writeUInt32BE(maxRows);

  return createPgMessage(FrontendMessageType.Execute, writer.getBuffer());
}

export function handlePortalSuspendedMessage(
  _msg: PgMessage,
  _context: Context
) {
  console.log("Portal suspended, issue another execute");
}

export function createSyncMessage(): Buffer {
  return createPgMessage(FrontendMessageType.Sync);
}
