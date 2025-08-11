import { Socket } from "node:net";
import { ColumnDescription, RowValue } from "./row-description";
import EventEmitter from "node:events";

export enum ReadyForQueryStatus {
  Idle = "I",
  InTransaction = "T",
  InFailedTransaction = "E",
}

export interface Context {
  client: Socket;
  eventEmitter: EventEmitter;

  authentication: {
    user: string;
    password: string;
    database: string;

    clientNonce?: string | null;
    clientFirstMessageBare?: Buffer | null;
    serverSignature?: Buffer | null;
  };

  sessionParameters: Record<string, string>;
  backendKeyData: {
    processId: number;
    secretKey: number;
  };
  readyForQueryStatus: ReadyForQueryStatus;

  currentQuery: {
    columns: ColumnDescription[];
    rows: RowValue[][];
    commandTag: string;
  };
}
