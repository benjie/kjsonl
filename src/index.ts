import { open, FileHandle } from "fs/promises";
import LRU from "@graphile/lru";
import { FSWatcher, watch } from "fs";

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
  const processKJSONLLine = (line: Buffer, offset: number) => {
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

/**
 * Beware, this class uses synchronous file operations, and so can lock up the
 * event loop. Not recommended for large files or slow/network disks.
 */
export class KJSONLGetter {
  private _handle: FileHandle | null = null;
  private _offsets: Map<string, [number, number]> | null = null;
  private _getKeysAndOffsetsPromise: ReturnType<
    KJSONLGetter["_getKeysAndOffsets"]
  > | null = null;
  private _lru: LRU<string, Promise<any> | any>;
  private _watcher: FSWatcher | null = null;
  private _released = false;
  constructor(
    private filePath: string,
    options?: { lruMaxLength?: number },
  ) {
    const { lruMaxLength = 1000 } = options ?? {};
    this._lru = new LRU({ maxLength: lruMaxLength });
  }

  public async init() {
    await this.getKeysAndOffsets();
  }

  private getKeysAndOffsets() {
    if (!this._getKeysAndOffsetsPromise) {
      this._getKeysAndOffsetsPromise = this._getKeysAndOffsets();
    }
    return this._getKeysAndOffsetsPromise;
  }

  private async _getKeysAndOffsets() {
    if (this._released) {
      throw new Error(`This instance has been released`);
    }
    this._offsets = new Map();
    this._watcher = watch(this.filePath, { persistent: true }, (change) => {
      console.log("Refreshing");
      this.refresh();
    });
    this._handle = await open(this.filePath, "r");
    for await (const lineDetails of kjsonlLines(this._handle)) {
      const { keyIsJSON, keyBuffer, valueStart, valueEnd } = lineDetails;
      const key = keyIsJSON
        ? JSON.parse(keyBuffer.toString("utf8"))
        : keyBuffer.toString("utf8");
      this._offsets.set(key, [valueStart, valueEnd]);
    }
    return this._offsets;
  }

  public get(key: string) {
    if (this._released) {
      throw new Error(`This instance has been released`);
    }
    const existingPromise = this._lru.get(key);
    if (existingPromise !== undefined) {
      return existingPromise;
    } else {
      const promise = (async () => {
        const offsets = await this.getKeysAndOffsets();
        const details = offsets.get(key);
        if (!details) {
          return undefined;
        } else {
          const [start, end] = details;
          const buffer = Buffer.alloc(end - start);
          await this._handle!.read(buffer, 0, end - start, start);
          const value = JSON.parse(buffer.toString("utf8"));
          this._lru.set(key, value);
          return value;
        }
      })();
      this._lru.set(key, promise);
      return promise;
    }
  }

  public async refresh() {
    if (this._released) {
      return;
    }
    await this._closeEverything();
    return this.init();
  }

  public async release() {
    this._released = true;
    await this._closeEverything();
  }

  /**
   * Also used from 'refresh', so make sure we can restore things if we need to
   */
  private async _closeEverything() {
    try {
      await this._getKeysAndOffsetsPromise;
    } catch (e) {
      // ignore
    }
    // Synchronous from here on out!
    if (this._handle) {
      this._handle.close().catch((e) => console.error(e));
      this._handle = null;
    }
    if (this._watcher) {
      this._watcher.close();
      this._watcher = null;
    }
    this._offsets = null;
  }
}
