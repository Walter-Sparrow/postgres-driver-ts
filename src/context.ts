import { Socket } from "node:net";

export enum ReadyForQueryStatus {
  Idle = "I",
  InTransaction = "T",
  InFailedTransaction = "E",
}

export interface Context {
  client: Socket;

  authentication: {
    user: string;
    password: string;
    database: string;

    clientNonce?: string | null;
    clientFirstMessageBare?: Buffer | null;
    serverSignature?: Buffer | null;

    isConnected: boolean;
  };

  sessionParameters: Record<string, string>;
  backendKeyData: {
    processId: number;
    secretKey: number;
  };
  readyForQueryStatus: ReadyForQueryStatus;
}
