# DD — NovelAI Developer Panel (Proof of Concept)

A minimal [NovelAI](https://novelai.net) user script that adds a **Developer
Panel** UI extension below the editor. The panel contains:

- a **text display**, and
- a **text input**.

When you type text into the input and submit it (press <kbd>Enter</kbd>), the
text display updates to show exactly what was sent.

This is a proof of concept for working with NovelAI's scripting / UI extension
API.

## Files

| Path | Description |
| --- | --- |
| `src/developer-panel.naiscript` | The user script. This is the file you load into NovelAI. |
| `external/script-types.d.ts` | Official NovelAI scripting API type definitions, copied locally for editor autocomplete and type-checking. |
| `tsconfig.json` | TypeScript config used to type-check the script against the API types. |

> `external/script-types.d.ts` is NovelAI's published type definition file
> (originally served at `https://novelai.net/scripting/types/script-types.d.ts`).
> It is vendored here so the script can be developed and type-checked offline.

## How it works

NovelAI runs user scripts in an isolated JavaScript interpreter inside a Web
Worker. Scripts cannot touch the DOM directly; they build UI by registering
**UI extensions** through `api.v1.ui`.

The script registers a `scriptPanel` extension. Inside it:

1. A `text` part (with id `developerPanelDisplay`) is the display.
2. A `textInput` part (with id `developerPanelInput`) is the input. Its
   `onSubmit` callback fires when the user presses Enter.
3. On submit, `api.v1.ui.updateParts(...)` updates the display part in place,
   by id, with the submitted value.

```ts
api.v1.ui.updateParts([
  { id: "developerPanelDisplay", type: "text", text: submittedValue },
]);
```

## Loading the script in NovelAI

1. Open NovelAI and open the **User Scripts** modal (the goose menu in the
   left sidebar, the Advanced tab of the right sidebar when a story is
   selected, or press <kbd>Alt</kbd>+<kbd>X</kbd>).
2. Create a new script and paste the contents of
   `src/developer-panel.naiscript`.
3. Enable the script. A **Developer Panel** entry appears in the panel list
   below the editor — open it to use the display and input.

## Developing / type-checking

The `.naiscript` file is a normal TypeScript file with a YAML front-matter
header inside a leading block comment. To type-check the logic against the
official API types:

```sh
# tsc does not read the .naiscript extension, so check a .ts copy of the body:
cp src/developer-panel.naiscript /tmp/developer-panel.ts
npx tsc --noEmit --strict --lib ES2020,DOM \
  external/script-types.d.ts /tmp/developer-panel.ts
```

Editors with TypeScript support will pick up the API types automatically via
the `/// <reference path="../external/script-types.d.ts" />` directive at the
top of the script.

## References

- NovelAI Scripting introduction: <https://docs.novelai.net/en/scripting/introduction/>
- NovelAI Scripting API reference: <https://docs.novelai.net/en/scripting/api-reference/>
- Official example scripts: <https://github.com/NovelAI/novelai-script-examples>
