import { PgMessage } from "./message.js";
import { Reader } from "./reader.js";
import { createPasswordMessage } from "./auth-md5.js";
import {
  createSASLInitialResponse,
  parseSASLContinueMessage,
  createSASLResponse,
  parseSASLFinalMessage,
} from "./auth-sasl.js";
import { Context } from "./context.js";
import {
  createBindMessage,
  createDescribeMessage,
  createExecuteMessage,
  createParseMessage,
  createSyncMessage,
} from "./extended-query.js";
import { ObjectId } from "./constants.js";

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

export function handleAuthenticationMessage(
  pgMsg: PgMessage,
  context: Context
) {
  const msg = parseAuthenticationMessage(pgMsg);
  switch (msg.type) {
    case ServerAuthenticationMessageType.AuthenticationOk:
      handleAuthenticationOkMessage(msg, context);
      break;
    case ServerAuthenticationMessageType.AuthenticationSASL:
      handleAuthenticationSASLMessage(msg, context);
      break;
    case ServerAuthenticationMessageType.AuthenticationSASLContinue:
      handleAuthenticationSASLContinueMessage(msg, context);
      break;
    case ServerAuthenticationMessageType.AuthenticationSASLFinal:
      handleAuthenticationSASLFinalMessage(msg, context);
      break;
    case ServerAuthenticationMessageType.AuthenticationMD5Password: {
      handleAuthenticationMD5PasswordMessage(msg, context);
      break;
    }
  }
}

function handleAuthenticationOkMessage(
  _msg: AuthenticationOk,
  context: Context
) {
  console.log("Authentication successful");
  context.authentication.isConnected = true;

  const parseMsg = createParseMessage({
    query: "select id, name from public.users where age > $1",
    paramTypes: [ObjectId.Int2],
  });
  context.client.write(parseMsg);

  const bindMsg = createBindMessage({
    paramFormatCodes: [],
    paramValues: [Buffer.from("20", "utf8")],
    resultFormatCodes: [],
  });
  context.client.write(bindMsg);

  const describeMsg = createDescribeMessage({ subject: "portal" });
  context.client.write(describeMsg);

  const executeMsg = createExecuteMessage({ maxRows: 1 });
  context.client.write(executeMsg);
  context.client.write(executeMsg);
  context.client.write(executeMsg);

  const syncMsg = createSyncMessage();
  context.client.write(syncMsg);
  // sendQueryMessage(
  //   "SELECT * FROM public.users; SELECT * FROM public.products;",
  //   context
  // );
}

function handleAuthenticationSASLMessage(
  msg: AuthenticationSASL,
  context: Context
) {
  const {
    client,
    authentication: { user },
  } = context;

  console.log("Authentication message received:", msg.mechanisms);

  const { payload, nonce, base } = createSASLInitialResponse(
    user,
    AuthenticationSASLMechanism.SCRAM_SHA_256
  );
  context.authentication.clientNonce = nonce;
  context.authentication.clientFirstMessageBare = Buffer.from(base, "utf8");
  client.write(payload);
}

function handleAuthenticationSASLContinueMessage(
  msg: AuthenticationSASLContinue,
  context: Context
) {
  const {
    client,
    authentication: { password, clientNonce, clientFirstMessageBare },
  } = context;

  if (!clientNonce) {
    throw new Error("Client nonce is not set for SASL continue message");
  }

  if (!clientFirstMessageBare) {
    throw new Error("Client first message bare is not set for SASL continue");
  }

  const payload = parseSASLContinueMessage(msg.scramPayload, clientNonce);
  const response = createSASLResponse(
    payload,
    password,
    clientFirstMessageBare,
    msg.scramPayload
  );

  context.authentication.serverSignature = response.signature;
  context.authentication.clientNonce = null;
  client.write(response.payload);
}

function handleAuthenticationSASLFinalMessage(
  msg: AuthenticationSASLFinal,
  context: Context
) {
  const serverSignature = context.authentication.serverSignature;

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

  context.authentication.serverSignature = null;
}

function handleAuthenticationMD5PasswordMessage(
  msg: AuthenticationMD5Password,
  context: Context
) {
  const {
    client,
    authentication: { user, password },
  } = context;

  const salt = msg.salt;
  const passwordMessage = createPasswordMessage(user, password, salt);
  client.write(passwordMessage);
}
