#!/usr/bin/env node
import { parseArgs } from "util";

import { version } from "./version.js";
import { baseParseArgsConfig, commands, runners } from "./commands.js";
import {
  ParseArgOptionConfigExtended,
  ParseArgOptionsConfigExtended,
  ParseArgsConfigExtended,
  ParsedResults,
} from "./interfaces.js";

function printArg([name, value]: [
  name: string,
  value: ParseArgOptionConfigExtended,
]): string {
  const { type, short, description, placeholder } = value;
  return `
--${name}${type === "boolean" ? "" : ` <${placeholder}>`}\
${short ? `\n-${short}${type === "boolean" ? "" : ` <${placeholder}>`}` : ""}\
${
  description
    ? `

    ${description?.replace(/\n/g, "\n    ")}`
    : ""
}
`.trim();
}

function outputFlags(options: ParseArgOptionsConfigExtended) {
  return `${Object.entries(options).map(printArg).join("\n\n")}`;
}

async function main() {
  const { values, positionals } = parseArgs({
    baseParseArgsConfig,
    strict: false,
  });
  if (values.version) {
    console.log("v" + version);
    return;
  }
  const commandName = positionals[0] as keyof typeof commands;
  if (!commandName || !commands[commandName]) {
    console.log(
      `
Usage:

${Object.entries(commands)
  .map(
    ([commandName, spec]) => `\
  ${spec.example.replace(/\n/g, "\n  ")}

    ${spec.description.replace(/\n/g, "\n    ")}\
`,
  )
  .join("\n\n")}

Flags:

${outputFlags(baseParseArgsConfig.options)}
`.trim(),
    );
    return;
  }
  {
    const command = commands[commandName];
    const parseArgsConfig = {
      ...baseParseArgsConfig,
      ...command,
      options: {
        ...baseParseArgsConfig.options,
        ...command.options,
      },
    } satisfies ParseArgsConfigExtended;
    const parseResult = parseArgs(parseArgsConfig);

    function help(message?: string) {
      console.log(
        `\
${message ? message + "\n\n" : ""}\
${command.description}

Usage:

  ${command.example}
    
Flags:

${outputFlags(parseArgsConfig.options)}
`.trim(),
      );
    }
    if (parseResult.values.help) {
      return help();
    }
    const { values, positionals } = parseResult;

    await runners[commandName]({
      values: values as any,
      positionals: positionals.slice(1),
      help,
    });
    return;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
