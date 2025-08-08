import { Context } from "./context.js";
import { PgMessage } from "./message.js";
import { Reader } from "./reader.js";

export function handleCommandCompleteMessage(
  message: PgMessage,
  context: Context
) {
  const reader = new Reader(message.data);
  const commandTag = reader.readNullTerminatedString().slice(0, -1);
  context.currentQuery.commandTag = commandTag;

  console.log("Command complete:", commandTag);
  const columns = context.currentQuery.columnDescriptions.map(
    (c) => c.fieldName
  );
  const table = context.currentQuery.rows.map((row) => {
    const obj: Record<string, string | null> = {};
    row.forEach((val, i) => {
      obj[columns[i]] = val ? val.toString("utf8") : null;
    });
    return obj;
  });
  console.table(table);
  context.currentQuery = { columnDescriptions: [], rows: [], commandTag: "" };
}
