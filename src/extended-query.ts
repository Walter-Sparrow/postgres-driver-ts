import { ObjectId } from "./constants.js";
import { Context } from "./context.js";
import { createPgMessage, FrontendMessageType } from "./message.js";
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

export function createSyncMessage(): Buffer {
  return createPgMessage(FrontendMessageType.Sync);
}
