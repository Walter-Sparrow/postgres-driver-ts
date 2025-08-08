import { Context } from "./context.js";
import { PgMessage } from "./message.js";
import { Reader } from "./reader.js";

export function handleBackendKeyDataMessage(
  message: PgMessage,
  context: Context
) {
  const reader = new Reader(message.data);
  const processId = reader.readUInt32BE();
  const secretKey = reader.readUInt32BE();
  context.backendKeyData = { processId, secretKey };
}
