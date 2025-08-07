import { Socket } from "node:net";
import { PgMessage } from "./message.js";
import { Reader } from "./reader.js";
import { createPasswordMessage } from "./auth-md5.js";
import {
  createSASLInitialResponse,
  parseSASLContinueMessage,
  createSASLResponse,
  parseSASLFinalMessage,
} from "./auth-sasl.js";

export enum ServerAuthenticationMessageType {
  AuthenticationOk = 0,
  AuthenticationKerberosV5 = 2,
  AuthenticationCleartextPassword = 3,
  AuthenticationMD5Password = 5,
  AuthenticationGSS = 7,
  AuthenticationGSSContinue = 8,
  AuthenticationSASL = 10,
  AuthenticationSASLContinue = 11,
  AuthenticationSASLFinal = 12,
}

export enum AuthenticationSASLMechanism {
  SCRAM_SHA_256 = "SCRAM-SHA-256\0",
  SCRAM_SHA_256_PLUS = "SCRAM-SHA-256-PLUS\0",
}

function toAuthenticationSASLMechanism(
  mechanism: string
): AuthenticationSASLMechanism | undefined {
  if (mechanism === AuthenticationSASLMechanism.SCRAM_SHA_256) {
    return AuthenticationSASLMechanism.SCRAM_SHA_256;
  }

  if (mechanism === AuthenticationSASLMechanism.SCRAM_SHA_256_PLUS) {
    return AuthenticationSASLMechanism.SCRAM_SHA_256_PLUS;
  }

  return undefined;
}

export interface AuthenticationOk {
  type: ServerAuthenticationMessageType.AuthenticationOk;
}

export interface AuthenticationSASL {
  type: ServerAuthenticationMessageType.AuthenticationSASL;
  mechanisms: AuthenticationSASLMechanism[];
}

export interface AuthenticationSASLContinue {
  type: ServerAuthenticationMessageType.AuthenticationSASLContinue;
  scramPayload: Buffer;
}

export interface AuthenticationSASLFinal {
  type: ServerAuthenticationMessageType.AuthenticationSASLFinal;
  scramPayload: Buffer;
  length: number;
}

export interface AuthenticationMD5Password {
  type: ServerAuthenticationMessageType.AuthenticationMD5Password;
  salt: Buffer;
}

export type ServerAuthenticationMessage =
  | AuthenticationOk
  | AuthenticationSASL
  | AuthenticationSASLContinue
  | AuthenticationSASLFinal
  | AuthenticationMD5Password;

export function parseAuthenticationMessage(
  pgMsg: PgMessage
): ServerAuthenticationMessage {
  const reader = new Reader(pgMsg.data);
  const type = reader.readUInt32BE();

  switch (type) {
    case ServerAuthenticationMessageType.AuthenticationOk:
      return { type: ServerAuthenticationMessageType.AuthenticationOk };
    case ServerAuthenticationMessageType.AuthenticationSASL:
      const mechanisms: AuthenticationSASLMechanism[] = [];
      let mechanism = reader.readNullTerminatedString();
      while (mechanism !== "") {
        const enumValue = toAuthenticationSASLMechanism(mechanism);
        if (enumValue) mechanisms.push(enumValue);
        mechanism = reader.readNullTerminatedString();
      }
      return {
        type: ServerAuthenticationMessageType.AuthenticationSASL,
        mechanisms,
      };
    case ServerAuthenticationMessageType.AuthenticationSASLContinue:
      const scramPayload = reader.readRemaining();
      return {
        type: ServerAuthenticationMessageType.AuthenticationSASLContinue,
        scramPayload,
      };
    case ServerAuthenticationMessageType.AuthenticationSASLFinal:
      const finalPayload = reader.readRemaining();
      return {
        type: ServerAuthenticationMessageType.AuthenticationSASLFinal,
        length: pgMsg.length,
        scramPayload: finalPayload,
      };
    case ServerAuthenticationMessageType.AuthenticationMD5Password:
      const salt = reader.read(4);
      return {
        type: ServerAuthenticationMessageType.AuthenticationMD5Password,
        salt,
      };
    default:
      throw new Error(`Unknown authentication message type: ${type}`);
  }
}

const user = process.env.USER || "postgres";

let clientNonce: string | null = null;
let clientFirstMessageBare: Buffer | null = null;
let serverSignature: Buffer | null = null;

export function handleAuthenticationMessage(pgMsg: PgMessage, client: Socket) {
  const msg = parseAuthenticationMessage(pgMsg);
  switch (msg.type) {
    case ServerAuthenticationMessageType.AuthenticationOk:
      handleAuthenticationOkMessage(msg, client);
      break;
    case ServerAuthenticationMessageType.AuthenticationSASL:
      handleAuthenticationSASLMessage(msg, client);
      break;
    case ServerAuthenticationMessageType.AuthenticationSASLContinue:
      handleAuthenticationSASLContinueMessage(msg, client);
      break;
    case ServerAuthenticationMessageType.AuthenticationSASLFinal:
      handleAuthenticationSASLFinalMessage(msg, client);
      break;
    case ServerAuthenticationMessageType.AuthenticationMD5Password: {
      handleAuthenticationMD5PasswordMessage(msg, client);
      break;
    }
  }
}

function handleAuthenticationOkMessage(
  _msg: AuthenticationOk,
  _client: Socket
) {
  console.log("Authentication successful");
}

function handleAuthenticationSASLMessage(
  msg: AuthenticationSASL,
  client: Socket
) {
  console.log("Authentication message received:", msg.mechanisms);

  const { payload, nonce, base } = createSASLInitialResponse(
    user,
    AuthenticationSASLMechanism.SCRAM_SHA_256
  );
  clientNonce = nonce;
  clientFirstMessageBare = Buffer.from(base, "utf8");
  client.write(payload);
}

function handleAuthenticationSASLContinueMessage(
  msg: AuthenticationSASLContinue,
  client: Socket
) {
  if (!clientNonce) {
    throw new Error("Client nonce is not set for SASL continue message");
  }

  if (!clientFirstMessageBare) {
    throw new Error("Client first message bare is not set for SASL continue");
  }

  const payload = parseSASLContinueMessage(msg.scramPayload, clientNonce);
  const response = createSASLResponse(
    payload,
    process.env.PASS || "",
    clientFirstMessageBare,
    msg.scramPayload
  );

  serverSignature = response.signature;
  clientNonce = null;
  client.write(response.payload);
}

function handleAuthenticationSASLFinalMessage(
  msg: AuthenticationSASLFinal,
  _client: Socket
) {
  if (!serverSignature) {
    throw new Error("Server signature is not set for SASL final message");
  }

  const payload = parseSASLFinalMessage(msg.scramPayload);
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

function handleAuthenticationMD5PasswordMessage(
  msg: AuthenticationMD5Password,
  client: Socket
) {
  const salt = msg.salt;
  const password = process.env.PASS || "";
  const passwordMessage = createPasswordMessage(user, password, salt);
  client.write(passwordMessage);
}
