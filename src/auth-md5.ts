import { createHash } from "node:crypto";

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

  const totalLength = 4 + passwordBuffer.length;
  const buffer = Buffer.alloc(1 + totalLength);

  let offset = 0;
  buffer.writeUInt8("p".charCodeAt(0), offset);
  offset += 1;

  buffer.writeUInt32BE(totalLength, offset);
  offset += 4;

  passwordBuffer.copy(buffer, offset);

  return buffer;
}
