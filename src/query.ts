import { Context } from "./context.js";
import { createPgMessage, MessageType } from "./message.js";

export function sendQueryMessage(query: string, context: Context) {
  const msg = createPgMessage(
    MessageType.Query,
    Buffer.from(query + "\0", "utf8")
  );
  context.client.write(msg);
}
