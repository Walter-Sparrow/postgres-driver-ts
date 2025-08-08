import { Context } from "./context.js";
import { PgMessage } from "./message.js";
import { Reader } from "./reader.js";

export enum FormatCode {
  Text = 0,
  Binary = 1,
}

export interface ColumnDescription {
  fieldName: string;
  tableId: number;
  columnId: number;
  dataType: number;
  dataTypeSize: number;
  typeModifier: number;
  format: FormatCode;
}

export function handleRowDescriptionMessage(
  message: PgMessage,
  context: Context
) {
  const reader = new Reader(message.data);
  const columnCount = reader.readUInt16BE();
  for (let i = 0; i < columnCount; i++) {
    const fieldName = reader.readNullTerminatedString().slice(0, -1);
    const tableId = reader.readUInt32BE();
    const columnId = reader.readUInt16BE();
    const dataType = reader.readUInt32BE();
    const dataTypeSize = reader.readUInt16BE();
    const typeModifier = reader.readUInt32BE();
    const format = reader.readUInt16BE();

    context.currentQuery.columnDescriptions.push({
      fieldName,
      tableId,
      columnId,
      dataType,
      dataTypeSize,
      typeModifier,
      format,
    });
  }
}

export type RowValue = Buffer | null;

export function handleDataRowMessage(message: PgMessage, context: Context) {
  const reader = new Reader(message.data);
  const columnCount = reader.readUInt16BE();
  const rows = [];
  for (let i = 0; i < columnCount; i++) {
    const length = reader.readInt32BE();
    let data: Buffer | null = null;
    if (length > 0) {
      data = reader.read(length);
    }
    rows.push(data);
  }
  context.currentQuery.rows.push(rows);
}
