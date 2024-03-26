# kjsonl

**WORK IN PROGRESS**

An easy to parse file format for large amounts of key-value storage in JSON format.

- KJSONL (`.kjsonl`) - key, JSON, linefeed
- KJSONLU (`.kjsonlu`) - key, JSON, linefeed (unsorted)

Example:

```
"population:one": "VR Game"
favourite_book: {"title": "Good Omens", "authors": ["Terry Pratchett", "Neil Gaiman"]}
meaning_of_life: 42
```

Basic rules:

1. Files are encoded in UTF8
1. Lines are delimited by `\n` or `\r\n`
1. Lines beginning with `#` are ignored
1. Empty lines are ignored
1. Every non-ignored line must define a key-value pair as follows:
   1. First the encoded key
   1. Next a colon
   1. Next, optionally, a single space character
   1. Finally, the JSON-encoded value all on one line
1. For `.kjsonl` files, other than ignored lines, every line in the file must
   be sorted by the encoded value of the key

Encoding a key is simple:

1. If `key` contains a "special character" or is empty, return `JSON.stringify(key)`
1. Otherwise return `key`

NOTE: when serializing to KJSONL in other languages, it's essential to match
the behavior of JavaScript's `JSON.stringify()` function.

Special characters are any characters that require escaping in JSON, any
character with a UTF8 code point value greater than 127, any whitespace
character, and the `:` and `#` characters. (TBC.)

JSON encoded values must have all optional whitespace removed (in particular
this means they will not contain CR or LF characters).

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
