export class Writer {
  private offset = 0;
  private buffer: Buffer;

  constructor(size: number = 0) {
    this.buffer = Buffer.alloc(size);
  }

  static from(buffer: Buffer, offset: number = 0) {
    const writer = new Writer();
    writer.buffer = buffer;
    writer.offset = offset;
    return writer;
  }

  write(data: Buffer) {
    data.copy(this.buffer, this.offset);
    this.offset += data.length;
  }

  writeUInt8(data: number) {
    this.buffer.writeUInt8(data, this.offset);
    this.offset += 1;
  }

  writeUInt32BE(data: number) {
    this.buffer.writeUInt32BE(data, this.offset);
    this.offset += 4;
  }

  getBuffer() {
    return this.buffer;
  }
}
