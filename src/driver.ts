import { Context, ReadyForQueryStatus } from "./context.js";
import { createStartupMessage, handlePgMessages } from "./message.js";
import net from "node:net";

const user = process.env.USER || "postgres";
const password = process.env.PASS || "";
const database = process.env.DATABASE || "postgres";

const context: Context = {
  client: null!,
  authentication: {
    user,
    password,
    database,
    isConnected: false,
  },
  sessionParameters: {},
  backendKeyData: { processId: 0, secretKey: 0 },
  readyForQueryStatus: ReadyForQueryStatus.Idle,
};

const client = net.createConnection({ port: 5432, noDelay: true }, () => {
  context.client = client;

  const startupMessage = createStartupMessage({
    user,
    database,
  });
  client.write(startupMessage);
});

client.on("data", (data) => {
  console.log("Received data from server:", data.toString("utf8"));
  handlePgMessages(data, context);
});

client.on("error", () => {
  context.authentication.isConnected = false;
  console.log("Connection error");
});

client.on("end", () => {
  context.authentication.isConnected = false;
  console.log("Connection closed");
});
