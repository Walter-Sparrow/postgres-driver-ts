import { createPasswordMessage } from "./auth-md5.js";
import {
  createSASLInitialResponse,
  createSASLResponse,
  parseSASLContinueMessage,
  parseSASLFinalMessage,
} from "./auth-sasl.js";
import {
  AuthenticationSASLMechanism,
  parseAuthenticationMessage,
  ServerAuthenticationMessageType,
} from "./auth.js";
import { createStartupMessage } from "./message.js";
import net from "node:net";

const user = process.env.USER || "postgres";

let clientNonce: string | null = null;
let clientFirstMessageBare: Buffer | null = null;
let serverSignature: Buffer | null = null;

const client = net.createConnection({ port: 5432, noDelay: true }, () => {
  const startupMessage = createStartupMessage({
    user,
    database: process.env.DATABASE || "postgres",
  });
  client.write(startupMessage);
});

client.on("data", (data) => {
  console.log("Received data from server:", data.toString("utf8"));

  const authenticationMessage = parseAuthenticationMessage(data);
  switch (authenticationMessage.type) {
    case ServerAuthenticationMessageType.AuthenticationOk:
      console.log("Authentication successful");
      break;
    case ServerAuthenticationMessageType.AuthenticationSASL:
      {
        console.log(
          "Authentication message received:",
          authenticationMessage.mechanisms
        );

        const { payload, nonce, base } = createSASLInitialResponse(
          user,
          AuthenticationSASLMechanism.SCRAM_SHA_256
        );
        clientNonce = nonce;
        clientFirstMessageBare = Buffer.from(base, "utf8");
        client.write(payload);
      }
      break;
    case ServerAuthenticationMessageType.AuthenticationSASLContinue:
      {
        if (!clientNonce) {
          throw new Error("Client nonce is not set for SASL continue message");
        }

        const payload = parseSASLContinueMessage(
          authenticationMessage.scramPayload,
          clientNonce
        );

        if (!clientFirstMessageBare) {
          throw new Error(
            "Client first message bare is not set for SASL continue"
          );
        }

        clientNonce = null;
        const response = createSASLResponse(
          payload,
          process.env.PASS || "",
          clientFirstMessageBare,
          authenticationMessage.scramPayload
        );
        serverSignature = response.signature;
        client.write(response.payload);
      }
      break;
    case ServerAuthenticationMessageType.AuthenticationSASLFinal:
      {
        if (!serverSignature) {
          throw new Error("Server signature is not set for SASL final message");
        }

        const payload = parseSASLFinalMessage(
          authenticationMessage.scramPayload,
          authenticationMessage.length
        );

        if (!payload.equals(serverSignature)) {
          throw new Error(
            "Server signature does not match expected signature, expected: " +
              serverSignature.toString("utf8") +
              ", got: " +
              payload.toString("utf8")
          );
        }

        serverSignature = null;
      }
      break;
    case ServerAuthenticationMessageType.AuthenticationMD5Password: {
      const salt = authenticationMessage.salt;
      const password = process.env.PASS || "";
      const passwordMessage = createPasswordMessage(user, password, salt);
      client.write(passwordMessage);
    }
  }
});

client.on("end", () => {
  console.log("disconnected from server");
});
