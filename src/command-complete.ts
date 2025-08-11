import { Context } from "./context.js";
import { PgMessage } from "./message.js";
import { SimpleQueryResult } from "./query.js";
import { Reader } from "./reader.js";

export function handleCommandCompleteMessage(
  message: PgMessage,
  context: Context
) {
  const reader = new Reader(message.data);
  const commandTag = reader.readNullTerminatedString().slice(0, -1);
  context.currentQuery.commandTag = commandTag;

  const result: SimpleQueryResult = {
    commandTag,
    columns: context.currentQuery.columns,
    rows: context.currentQuery.rows,
  };
  context.eventEmitter.emit("commandComplete", result);

  console.log("Command complete:", commandTag);
  const columns = context.currentQuery.columns.map((c) => c.fieldName);
  const table = context.currentQuery.rows.map((row) => {
    const obj: Record<string, string | null> = {};
    row.forEach((val, i) => {
      obj[columns[i]] = val ? val.toString("utf8") : null;
    });
    return obj;
  });
  console.table(table);
  context.currentQuery = { columns: [], rows: [], commandTag: "" };
}
