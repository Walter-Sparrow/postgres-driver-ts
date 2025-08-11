import { Context } from "./context.js";
import { createPgMessage, FrontendMessageType } from "./message.js";
import { ColumnDescription, RowValue } from "./row-description.js";

export interface SimpleQueryResult {
  columns: ColumnDescription[];
  rows: RowValue[][];
  commandTag: string;
}

export function sendQueryMessage(query: string, context: Context) {
  const msg = createPgMessage(
    FrontendMessageType.Query,
    Buffer.from(query + "\0", "utf8")
  );
  context.client.write(msg);
}
