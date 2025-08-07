export class Reader {
  private offset = 0;
  private buffer: Buffer;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  read(length: number): Buffer {
    const result = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return result;
  }

  readRemaining(): Buffer {
    const result = this.buffer.subarray(this.offset);
    this.offset = this.buffer.length;
    return result;
  }

  readUInt8(): number {
    const result = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return result;
  }

  readUInt32BE(): number {
    const result = this.buffer.readUInt32BE(this.offset);
    this.offset += 4;
    return result;
  }

  readNullTerminatedString(): string {
    let end = this.offset;
    while (end < this.buffer.length && this.buffer[end] !== 0) {
      end++;
    }
    const str = this.buffer.subarray(this.offset, end + 1).toString("utf8");
    this.offset = end + 1;
    return str;
  }
}
