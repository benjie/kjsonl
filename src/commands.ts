import { FileHandle, open, rename } from "fs/promises";
import {
  Commands,
  Evaluate,
  KJSONLLineDigest,
  ParseArgsConfigExtended,
  ParsedResults,
} from "./interfaces.js";
import { kjsonlLines } from "./lines.js";
import { COLON_BUFFER, NEWLINE_BUFFER } from "./constants.js";
import { sort } from "./sort.js";

export const baseParseArgsConfig = {
  options: {
    help: {
      type: "boolean",
      placeholder: undefined,
      short: "h",
      description: "Output available CLI flags",
    },
    version: {
      type: "boolean",
      placeholder: undefined,
      short: "v",
      description: "Output the version",
    },
  },
  allowPositionals: true,
  strict: true,
} satisfies ParseArgsConfigExtended;

export const commands = {
  delete: {
    example: "kjsonl delete -t path/to/file.kjsonl key1 [key2...]",
    description: "Delete the given keys from the given KJSONL file",
    options: {
      target: {
        short: "t",
        type: "string",
        description: "The file to delete keys from",
        placeholder: "target.kjsonl",
        required: true,
      },
    },
    allowPositionals: true,
  },
  json: {
    example: "kjsonl json path/to/file.kjsonl",
    description: "Output the given kjsonl file as JSON",
    options: {
      compact: {
        short: "c",
        description: "compact instead of pretty-printed output",
        type: "boolean",
      },
    },
    allowPositionals: true,
  },
  merge: {
    example: "kjsonl merge -t target.kjsonl source1.kjsonl [source2.kjsonl...]",
    description:
      "Merge the contents of the given source files into the target file. If the target file doesn't exist, create it.",
    options: {
      target: {
        short: "t",
        type: "string",
        description: "The file to write the result to",
        placeholder: "target.kjsonl",
        required: true,
      },
    },
    allowPositionals: true,
  },
} satisfies Commands;

export const runners: {
  [TKey in keyof typeof commands]: (
    r: ParsedResults<{
      options: (typeof baseParseArgsConfig)["options"] &
        Evaluate<(typeof commands)[TKey]["options"]>;
      allowPositionals: (typeof commands)[TKey]["allowPositionals"];
    }> & { help(message: string): void },
  ) => Promise<void>;
} = {
  async delete({ values, positionals, help }) {
    if (positionals.length < 1) {
      return help("Expected at least one key to delete.");
    }

    const filePath = values.target!;
    const writePath = filePath + ".tmpreplacement";
    const handle = await open(filePath, "r");
    const writeHandle = await open(writePath, "w");
    for await (const lineDetails of kjsonlLines(handle)) {
      const { keyIsJSON, keyBuffer, valueBuffer } = lineDetails;
      const key = keyIsJSON
        ? JSON.parse(keyBuffer.toString("utf8"))
        : keyBuffer.toString("utf8");
      if (!positionals.includes(key)) {
        // copy to output
        const line = Buffer.concat([
          keyBuffer,
          COLON_BUFFER,
          valueBuffer,
          NEWLINE_BUFFER,
        ]);
        await writeHandle.write(line);
      }
    }
    await handle.close();
    await writeHandle.close();
    await rename(writePath, filePath);
  },

  async json({ values, positionals, help }) {
    if (positionals.length !== 1) {
      return help("Expected exactly one positional argument.");
    }
    const { compact = false } = values;
    const filePath = positionals[0];
    const handle = await open(filePath, "r");
    process.stdout.write("{");
    let first = true;
    for await (const lineDetails of kjsonlLines(handle)) {
      const { keyIsJSON, keyBuffer, valueBuffer } = lineDetails;
      const key = keyIsJSON
        ? JSON.parse(keyBuffer.toString("utf8"))
        : keyBuffer.toString("utf8");
      process.stdout.write(
        `${first ? "" : ","}${compact ? "" : `\n  `}${JSON.stringify(key)}:${compact ? "" : " "}${valueBuffer.toString("utf8")}`,
      );
      first = false;
    }
    await handle.close();
    process.stdout.write(`${first || compact ? "" : "\n"}}\n`);
  },

  async merge({ values, positionals }) {
    const filePath = values.target!;
    const writePath = filePath + ".tmpreplacement";

    const handles: FileHandle[] = [];
    const handleFilePaths: string[] = [];

    try {
      const handle = await open(filePath, "r");
      handles.push(handle);
      handleFilePaths.push(filePath);
    } catch (e: any) {
      if (e.code === "ENOENT") {
      } else {
        throw e;
      }
    }

    for (const filePath of positionals) {
      const handle = await open(filePath, "r");
      handles.push(handle);
      handleFilePaths.push(filePath);
    }

    const l = handles.length;

    // Array of length l
    const lineGenerators = handles.map((handle) => kjsonlLines(handle));
    async function getNext(g: AsyncGenerator<KJSONLLineDigest>) {
      const n = await g.next();
      if (n.done) {
        return null;
      }
      const v = n.value;
      const kText = v.keyBuffer.toString("utf8");
      return {
        ...v,
        key: v.keyIsJSON ? JSON.parse(kText) : kText,
      };
    }
    // Array of length l
    const lineGeneratorNext = await Promise.all(lineGenerators.map(getNext));

    const writeHandle = await open(writePath, "w");
    let lastKey: string | null = null;
    while (lineGeneratorNext.some((d) => d !== null)) {
      let winner: {
        key: string;
        matches: Array<{
          index: number;
          match: KJSONLLineDigest & { key: string };
        }>;
      } | null = null;
      for (let index = 0; index < l; index++) {
        const n = lineGeneratorNext[index];
        if (n === null) continue;
        if (winner === null) {
          winner = {
            key: n.key,
            matches: [{ index, match: n }],
          };
        } else {
          const s = sort(n.key, winner.key);
          if (s < 0) {
            winner = {
              key: n.key,
              matches: [{ index, match: n }],
            };
          } else if (s === 0) {
            winner.matches.push({ index, match: n });
          }
        }
      }
      if (winner === null) {
        throw new Error(`Should be impossible`);
      }
      if (lastKey === winner.key) {
        console.warn(
          `Duplicate key '${lastKey}' found in '${winner.matches.map(({ index }) => handleFilePaths[index]).join("', '")}'; ignoring duplicate entries (earlier entry wins).`,
        );
      } else {
        lastKey = winner.key;
        const lastMatch = winner.matches[winner.matches.length - 1].match;
        const line = Buffer.concat([
          lastMatch.keyBuffer,
          COLON_BUFFER,
          lastMatch.valueBuffer,
          NEWLINE_BUFFER,
        ]);
        await writeHandle.write(line);
      }
      for (const { index } of winner.matches) {
        lineGeneratorNext[index] = await getNext(lineGenerators[index]);
      }
    }

    await Promise.all(handles.map((h) => h.close()));
    await writeHandle.close();
    await rename(writePath, filePath);
  },
};
