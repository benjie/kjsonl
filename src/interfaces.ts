import type { ParseArgsConfig, parseArgs } from "util";

type ParseArgOptionConfig = Exclude<
  ParseArgsConfig["options"],
  undefined
>[string];
export type ParseArgOptionConfigExtended = ParseArgOptionConfig & {
  description?: string;
  placeholder?: string;
};
export type ParseArgOptionsConfigExtended = {
  [argName: string]: ParseArgOptionConfigExtended;
};
export type ParsedResults<T extends ParseArgsConfigExtended> = ReturnType<
  typeof parseArgs<T>
>;

export interface ParseArgsConfigExtended extends ParseArgsConfig {
  options: ParseArgOptionsConfigExtended;
}

export interface Commands {
  [commandName: string]: ParseArgsConfigExtended & {
    example: string;
    description: string;
  };
}

export type Evaluate<T> = { [K in keyof T]: T[K] };
