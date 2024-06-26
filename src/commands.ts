import { open, rename } from "fs/promises";
import {
  Commands,
  Evaluate,
  ParseArgsConfigExtended,
  ParsedResults,
} from "./interfaces.js";
import { kjsonlLines } from "./lines.js";
import { COLON_BUFFER, NEWLINE_BUFFER } from "./constants.js";

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
    console.log({ values, positionals });
  },
};
