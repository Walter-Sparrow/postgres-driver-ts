import { createHash } from "node:crypto";
import { createPgMessage, MessageType } from "./message.js";

export function createPasswordMessage(
  user: string,
  password: string,
  salt: Buffer
): Buffer {
  const innterHash = createHash("md5")
    .update(password + user, "utf8")
    .digest("hex");

  const outerHash = createHash("md5")
    .update(Buffer.concat([Buffer.from(innterHash, "utf-8"), salt]))
    .digest("hex");

  const finalPassword = "md5" + outerHash;
  const passwordBuffer = Buffer.from(finalPassword + "\0", "utf-8");

  return createPgMessage(MessageType.Password, passwordBuffer);
}
