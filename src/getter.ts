import { open, FileHandle } from "fs/promises";
import { FSWatcher, watch } from "fs";
import LRU from "@graphile/lru";
import { kjsonlLines } from "./lines.js";

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
  private _shouldWatch: boolean;
  constructor(
    private filePath: string,
    options?: { lruMaxLength?: number; watch?: boolean },
  ) {
    const { lruMaxLength = 1000, watch = true } = options ?? {};
    this._lru = new LRU({ maxLength: lruMaxLength });
    this._shouldWatch = watch;
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
    if (this._shouldWatch) {
      this._watcher = watch(this.filePath, { persistent: true }, (change) => {
        console.log("Refreshing");
        this.refresh();
      });
    }
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
