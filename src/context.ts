import { Socket } from "node:net";

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
}
