export const PROTOCOL_VERSION = 196608; // PostgreSQL protocol version 3.0

export enum ObjectId {
  Bool = 16,
  Byte = 17,
  Char = 18,
  Name = 19,
  Int8 = 20,
  Int2 = 21,
  Int4 = 23,
  RegProc = 24,
  Text = 25,
  OID = 26,
  JSON = 114,
  Float = 700,
  Double = 701,
  VarChar = 1043,
  Date = 1082,
  Time = 1083,
  Timestamp = 1114,
}

export enum FormatCode {
  Text = 0,
  Binary = 1,
}
