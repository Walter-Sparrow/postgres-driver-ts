import { createConnection as createNetConnection } from "node:net";
import { Context, ReadyForQueryStatus } from "./context.js";
import { createStartupMessage, handlePgMessages } from "./message.js";
import { sendQueryMessage, SimpleQueryResult } from "./query.js";
import { Error } from "./error-response.js";
import EventEmitter from "node:events";

export class Connection {
  constructor(private context: Context) {}

  simpleQuery(query: string): Promise<SimpleQueryResult> {
    return new Promise((resolve, reject) => {
      const onResult = (result: SimpleQueryResult) => {
        resolve(result);
        cleanup();
      };

      const onError = (errors: Error[]) => {
        reject(errors);
        cleanup();
      };

      this.context.eventEmitter.once("commandComplete", onResult);
      this.context.eventEmitter.once("errorResponse", onError);

      const cleanup = () => {
        this.context.eventEmitter.removeListener("commandComplete", onResult);
        this.context.eventEmitter.removeListener("errorResponse", onError);
      };

      sendQueryMessage(query, this.context);
    });
  }
}

interface Options {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function createConnection(
  options: Options,
  connectionListener?: () => void
): Connection {
  const { user, password, database, host, port } = options;

  const context: Context = {
    client: null!,
    eventEmitter: new EventEmitter(),
    authentication: {
      user,
      password,
      database,
    },
    sessionParameters: {},
    backendKeyData: { processId: 0, secretKey: 0 },
    readyForQueryStatus: ReadyForQueryStatus.Idle,
    currentQuery: { columns: [], rows: [], commandTag: "" },
  };

  const socket = createNetConnection({ host, port }, () => {
    context.client = socket;

    const startupMessage = createStartupMessage({
      user,
      database,
    });
    console.log("Startup message:", startupMessage);
    socket.write(startupMessage);
  });

  if (connectionListener) {
    context.eventEmitter.once("connected", connectionListener);
  }

  const cleanup = () => {
    if (connectionListener) {
      context.eventEmitter.removeListener("connected", connectionListener);
    }
  };

  socket.on("data", (data) => handlePgMessages(data, context));
  socket.on("error", (error) => {
    console.error(error);
    cleanup();
  });
  socket.on("close", () => {
    console.log("Connection closed");
    cleanup();
  });

  context.client = socket;
  return new Connection(context);
}
