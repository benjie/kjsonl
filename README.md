# kjsonl

An easy to parse file format for large amounts of key-value storage in JSON format.

- KJSONL (`.kjsonl`) - key, JSON, linefeed
- KJSONLU (`.kjsonlu`) - key, JSON, linefeed (unsorted)

Example:

```
"population:one": "VR Game"
favourite_book: {"title": "Good Omens", "authors": ["Terry Pratchett", "Neil Gaiman"]}
meaning_of_life: 42
```

## Installation

```
npm install kjsonl
```

## Library

```ts
import { KJSONLGetter } from "kjsonl";

// Create a getter for your chosen KJSONL file:
const getter = new KJSONLGetter(`path/to/file.kjsonl`);

// Your code here; within which you'll probably read one or more keys from the
// kjsonl file:
const value = await getter.get("my_key");

// Finally, release the getter:
await getter.release();
```

## CLI

The `kjsonl` module is shipped with a command-line `kjsonl` utility with the
following capabilities:

```
Usage:

  kjsonl get path/to/file.kjsonl key

    Get the value for the given key within the KJSONL file.

  kjsonl keys path/to/file.kjsonl

    Output the keys from the given KJSONL file.

  kjsonl json path/to/file.kjsonl

    Output the given kjsonl file as JSON.

  kjsonl merge -t target.kjsonl source1.kjsonl [source2.kjsonl...]

    Merge the contents of the given source files with the contents of the target file. If the target file doesn't exist, create it.

  kjsonl delete -t path/to/file.kjsonl key1 [key2...]

    Delete the given keys from the given KJSONL file.

Flags:

--help
-h

    Output available CLI flags

--version
-v

    Output the version
```

> [!WARNING]
> Currently the CLI makes assumptions that the files are KJSONL (sorted) files
> not KJSONLU (unsorted) files; this may impact some operations - for example,
> merge may not output what you would expect.

> [!CAUTION]
> If the CLI encounters git conflict markers, it will attempt to resolve the
> conflict by removing these markers and accepting both the incoming and
> current changes. This approach, however, may not accurately reflect key
> deletions when a conflict occurs.

## KJSONL spec

**WORK IN PROGRESS**

A KJSONL or KJSONLU file follows these rules:

1. File is encoded in UTF8
1. Lines are delimited by `\n` or `\r\n`
1. Lines beginning with `#` are ignored
1. Empty lines are ignored
1. Every non-ignored line must define a key-value pair as follows:
   1. First the encoded key
   1. Next a colon
   1. Next, optionally, a single space character
   1. Finally, the JSON-encoded value with all optional whitespace omitted
1. For `.kjsonl` files, other than ignored lines, every line in the file must
   be sorted by the encoded value of the key

Encoding a key:

1. If `key` contains a "special character" or is empty, return `JSON.stringify(key)`
1. Otherwise return `key`

Special characters are any characters that require escaping in JSON, any
character with a UTF8 code point value greater than 127, any whitespace
character, and the `:` and `#` characters. (TBC.)

NOTE: when serializing to KJSONL in other languages, it's essential to match
the behavior of JavaScript's `JSON.stringify()` function.

JSON encoded keys must omit all optional whitespace characters (this means a
JSON encoded key will always start and finish with a double quote (`"`)
character).

JSON encoded values must not contain newline (CR) or linefeed (LF) characters,
all other optional whitespace should be omitted.

Sorted keys: to ensure that git diffs are stable, and to enable dictionary
searches across extremely large files are possible, KJSONL files require that
entries are sorted. Sorting of two keys is defined in the following way:

1. Let {bytesA} be a list of the bytes in the UTF8-encoded encoded form of first key
1. Let {bytesB} be a list of the bytes in the UTF8-encoded encoded form of second key
1. Let {lenA} be the length of {bytesA}
1. Let {lenB} be the length of {bytesB}
1. Let {l} be the minimum of {lenA} and {lenB}
1. For each {i} from {0} to {l-1}:
   1. Let {a} be the numeric value of the byte at index {i} in {bytesA}
   1. Let {b} be the numeric value of the byte at index {i} in {bytesB}
   1. If {a < b}, return {-1}
   1. If {a > b}, return {1}
1. If {lenA < lenB} return {-1}
1. If {lenA > lenB} return {1}
1. Note: {bytesA} and {bytesB} must be identical
1. Return {0}

There must be no UTF8 BOM (`0xEF 0xBB 0xBF`) present in any KJSONL files; all
KJSONL files are UTF8 encoded so the BOM is unnecessary.
