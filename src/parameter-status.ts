import { Context } from "./context.js";
import { PgMessage } from "./message.js";
import { Reader } from "./reader.js";

export function handleParameterStatusMessage(
  message: PgMessage,
  context: Context
) {
  const reader = new Reader(message.data);
  const key = reader.readNullTerminatedString().slice(0, -1);
  const value = reader.readNullTerminatedString().slice(0, -1);
  context.sessionParameters[key] = value;
}
