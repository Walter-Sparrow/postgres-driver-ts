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
}
