import {
  Commands,
  Evaluate,
  ParseArgsConfigExtended,
  ParsedResults,
} from "./interfaces.js";

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
    example: "kjsonl delete path/to/file.kjsonl key1 [key2...]",
    description: "Delete the given keys from the given KJSONL file",
    options: {},
    allowPositionals: true,
  },
  json: {
    example: "kjsonl json path/to/file.kjsonl",
    description: "Output the given kjsonl file as JSON",
    options: {},
    allowPositionals: true,
  },
  merge: {
    example: "kjsonl merge -o target.kjsonl source1.kjsonl [source2.kjsonl...]",
    description:
      "Merge the contents of the given source files into the target file. If the target file doesn't exist, create it.",
    options: {
      output: {
        short: "o",
        type: "string",
        description: "The output file to write the result to",
        placeholder: "target.kjsonl",
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
    }>,
  ) => Promise<void>;
} = {
  async delete({ values, positionals }) {
    console.log({ values, positionals });
  },
  async json({ values, positionals }) {
    console.log({ values, positionals });
  },
  async merge({ values, positionals }) {
    console.log({ values, positionals });
  },
};
