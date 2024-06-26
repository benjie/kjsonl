import { FileHandle } from "fs/promises";
import { KJSONLLineDigest } from "./interfaces";

const NEWLINE = "\n".charCodeAt(0);
const DQUOT = '"'.charCodeAt(0);
const COLON = ":".charCodeAt(0);
const BACKSLASH = "\\".charCodeAt(0);
const SPACE = " ".charCodeAt(0);

export async function* kjsonlLines(
  fileHandle: FileHandle,
  options?: { bufferSize?: number; maxBuffers?: number },
) {
  const { bufferSize = 64 * 1024, maxBuffers = 100 } = options ?? {};
  let buffers: Buffer[] = [];
  let filePosition = 0;
  let alive = true;
  let lines = 0;
  const processKJSONLLine = (
    line: Buffer,
    offset: number,
  ): KJSONLLineDigest | null => {
    const position = filePosition + offset;
    const lineNumber = ++lines;
    const l = line.length;
    if (l === 0) {
      // Ignore empty lines
      return null;
    }
    let keyBuffer: Buffer | undefined;
    const keyIsJSON = line[0] === DQUOT;
    if (keyIsJSON) {
      // Using JSON-format string
      for (let n = 1; n < l; n++) {
        if (line[n] === DQUOT) {
          keyBuffer = line.subarray(0, n + 1);
          break;
        } else if (line[n] === BACKSLASH) {
          // Skip next character. \uNNNN escapes aren't special here, we only care about doublequotes really.
          n++;
        }
      }
      if (!keyBuffer) {
        throw new Error(
          `Malformed KJSONL, line ${lineNumber}: no closing '"' found`,
        );
      }
    } else {
      // Using unescaped string
      let n = line.indexOf(COLON);
      if (n < 0) {
        keyBuffer = line;
      } else {
        keyBuffer = line.subarray(0, n);
      }
      // TODO: throw an error if keyBuffer contains any forbidden characters
    }
    let pos = keyBuffer.length;
    if (pos >= l) {
      throw new Error(
        `Malformed KJSONL, line ${lineNumber}: key without value`,
      );
    }

    if (line[pos] !== COLON) {
      throw new Error(`Malformed KJSONL, line ${lineNumber}: expected ':'`);
    }
    pos++;

    if (line[pos] === SPACE) {
      // Skip exactly one optional space
      pos++;
    }

    const valueBuffer = line.subarray(pos);
    const valueStart = position + pos;
    const valueEnd = position + l;
    return {
      lineNumber,
      position,
      keyIsJSON,
      keyBuffer,
      valueBuffer,
      valueStart,
      valueEnd,
    };
  };
  while (alive) {
    let buffer = Buffer.alloc(bufferSize);
    const { bytesRead } = await fileHandle.read(
      buffer,
      0,
      bufferSize,
      filePosition,
    );
    let n: number;
    if (bytesRead === 0) {
      alive = false;
      const l = buffers.length;
      if (l === 0) {
        break;
      } else {
        n = buffers[l - 1].length;
      }
    } else {
      buffer = buffer.subarray(0, bytesRead);
      buffers.push(buffer);
      n = buffer.indexOf(NEWLINE);
    }
    if (n >= 0) {
      // Time to process.
      const lastBuffer = buffers.pop()!;
      const previous = buffers;
      const lastBufferFirstPart = lastBuffer.subarray(0, n);
      let offset = n + 1;
      const line = Buffer.concat([...previous, lastBufferFirstPart]);
      const processed = processKJSONLLine(line, 0);
      if (processed) {
        yield processed;
      }
      while ((n = lastBuffer.indexOf(NEWLINE, offset)) >= 0) {
        const line = lastBuffer.subarray(offset, n);
        const processed = processKJSONLLine(line, offset);
        if (processed) {
          yield processed;
        }
        offset = n + 1;
      }
      buffers = [lastBuffer.subarray(offset)];
    }
    if (buffers.length >= maxBuffers) {
      throw new Error(
        `Processed ${buffers.length} buffers of size ${bufferSize}b, but did not find any newlines; please check the KJSONL file is valid or increase the limits if you are dealing with larger values.`,
      );
    }
    filePosition += bytesRead;
  }
}
