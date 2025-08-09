import { Context } from "./context.js";
import { createPgMessage, FrontendMessageType } from "./message.js";

export function sendQueryMessage(query: string, context: Context) {
  const msg = createPgMessage(
    FrontendMessageType.Query,
    Buffer.from(query + "\0", "utf8")
  );
  context.client.write(msg);
}
