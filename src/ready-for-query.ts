import { Context, ReadyForQueryStatus } from "./context.js";
import { PgMessage } from "./message.js";
import { Reader } from "./reader.js";

export function handleReadyForQueryMessage(
  message: PgMessage,
  context: Context
) {
  const reader = new Reader(message.data);
  const status = reader.readUInt8();
  context.readyForQueryStatus = String.fromCharCode(
    status
  ) as ReadyForQueryStatus;
}
