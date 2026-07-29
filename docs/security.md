# Security

Pivotick runs entirely in the browser: there is no server, no session and no persistence of its
own. The boundary that matters is the one between **your graph data** and **your page's DOM** —
Pivotick renders the data you hand it into the document your application owns.

If that data comes from somewhere you don't fully control — a threat-intel feed, a CVE mirror, an
imported dataset, another user's upload — treat it as untrusted, and read the rest of this page.

## What Pivotick guarantees

Everything the library renders from your data is inserted as **text**, not markup. That covers
node and edge labels, descriptions, ids, property keys and values, and note content:

- Labels, descriptions and property names/values are written with `textContent`.
- Note content is Markdown, rendered with `marked` and then sanitized with
  [DOMPurify](https://github.com/cure53/DOMPurify) before insertion.
- `style.svgIcon` markup is sanitized (SVG profile) before it reaches the document, so event
  handlers, `<script>` and `<foreignObject>` are stripped.
- `style.imagePath` is restricted to the `http:`, `https:`, `data:` and `blob:` schemes.

A **`string` therefore always renders as text.** Wherever an option accepts
`string | HTMLElement`, returning a string gets you text; to render your own HTML, build and
return an `HTMLElement`:

```ts
// Renders the literal characters "<b>hi</b>"
propertiesPanel: { render: () => '<b>hi</b>' }

// Renders bold text
propertiesPanel: { render: () => {
    const el = document.createElement('b')
    el.textContent = 'hi'
    return el
} }
```

::: warning Changed in 1.4.0 / 1.5.0
Earlier versions parsed such strings as HTML — property values in 1.3.0 and earlier, every other
`string | HTMLElement` option (extra panels, context-menu entries, custom renderers) up to 1.4.0.
If you were relying on that to inject markup, switch to returning an element.
:::

## Trusted-HTML sinks

A few options exist specifically so you can supply your own markup. Pivotick inserts what you
give it **verbatim**, so never build these from untrusted data:

| Option | Where |
| --- | --- |
| `rawHeader` / `rawBody` | `Modal` and `SlidePanel` options |
| `render.defaultNodeStyle.html` | node contents drawn in a `<foreignObject>` |

If you need data inside one of these, put it in with `textContent` on an element you created,
rather than interpolating it into a markup string:

```ts
// Unsafe: node.data.label lands in innerHTML
uiManager.createModal({ rawBody: true, body: `<h1>${node.getData().label}</h1>` })

// Safe
const title = document.createElement('h1')
title.textContent = node.getData().label
uiManager.createModal({ body: title })
```

## Outbound requests

Nodes can reference pictures, via `style.imagePath` or an `<image href>` inside `style.svgIcon`.
Rendering such a node makes your users' browsers fetch that URL. If the URL came from untrusted
data, whoever wrote it learns that the graph was viewed, along with the viewer's IP address,
timing and `User-Agent` — a tracking pixel.

Scheme restrictions can't prevent this, because `https:` has to be allowed for the feature to
work at all. If your data is untrusted and this matters to you, either strip/rewrite image
references before handing the data over, or constrain them with a Content-Security-Policy.

## Recommended Content-Security-Policy

Pivotick needs no `eval` and no inline `<script>`, so it works under a strict policy. A CSP is
the cheapest way to blunt any injection — in the library, in your own code, or in another
dependency:

```
Content-Security-Policy:
    default-src 'self';
    script-src 'self';
    img-src 'self' data: blob: https://images.example.com;
    style-src 'self' 'unsafe-inline';
```

- `script-src` without `'unsafe-inline'` is what neutralizes injected event handlers.
- `img-src` is where you pin down which hosts node pictures may come from.
- `style-src 'unsafe-inline'` is currently required: the renderer sets inline styles, and
  Pivotick's stylesheet is normally injected by your bundler. Serve the CSS as a file and use a
  nonce or hash if you need to drop it.

## Reporting a vulnerability

Please report suspected vulnerabilities through
[GitHub security advisories](https://github.com/Pivotick/Pivotick/security/advisories) rather
than a public issue.
