# Automatic Babel-based Translation Generator for JS/JSX

The idea: Writing software in Russian is cool because Cyrillic letters differ
from Latin. This means you can extract all strings that need localisation
automatically, without manually wrapping all messages into `_()` or
`<LocalizedMessage />` or anything else.

The same is also true for other languages with an alphabet different from Latin. :)

This Babel plugin implements this idea in practice.

# Usage

First install the plugin and include it into your Babel configuration. For example, in `.babelrc`:

```
{ ..., "plugins": [ ..., "react-translate" ] }
```

Or, if you want to specify options:

```
{ ..., "plugins": [ ..., [ "react-translate", { "output": "strings.json", "regexp": "[А-ЯЁа-яё]" } ] ] }
```

Then build your project as usual.

The plugin extracts all strings that match the given regexp and puts them
into the file specified by the `output` option (`react-translate-output.json`
by default), relative to the build root (directory containing package.json).

At the same time, the plugin replaces extracted strings with `L("message", param1, ..., paramN)`
function calls in the compilation result.

Now you just have to look into `strings.json`, translate strings from it into
desired languages and feed them to the plugin at runtime with:

```js
import { L, setLanguage, setFallback, setStrings } from 'babel-plugin-react-translate/runtime';

setStrings('en', { "Автор": "Author" });
setLanguage('en');
setFallback('ru');

// Now L() will translate Автор into Author:
L("Автор") == "Author";
```

Type of `strings.json` contents is `{ [filename: string]: string[] }` (TS).
I.e. it contains a JSON object with keys equal to source file names and values
equal to arrays of strings found in the corresponding file.

The plugin handles the following cases:

1. Simple string literals: `'Привет'` becomes `L("Привет")`.
2. Template literals: `` `Привет, ${name}!` `` becomes `L("Привет, {1}!", name)`.
3. Concatenated string literals: `'Привет, '+name+'!'` also becomes `L("Привет, {1}!", name)`.
4. JSX text: `<span>Привет!</span>` becomes `<span>{L("Привет!")}</span>`.

You can also use `L()` manually to handle more complex scenarios.

# Plural Forms

L() supports pluralisation, the syntax is `{N:<arg>:<one>:<few>:<many>}` (Russian and other
languages have different plural forms for "few" (2-4) and "many" objects). Example:

```
L("У меня {1} {N:1:брат:брата:братьев}!", 155)
```

You can also use it manually:

```js
import { plural } from 'babel-plugin-react-translate/runtime';

console.log(plural(155, 'брат', 'брата', 'братьев'));
```

# License and author

Author: Vitaliy Filippov, 2021+

License: GNU LGPLv3.0
