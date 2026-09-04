/**
 * Pivot & enrichment against a real misp-modules service. `npm run dev`, then
 * open `/misp-modules.html`.
 *
 * Where `/pivot.html` drives six hand-written providers, this page registers one
 * pivot per expansion module the service advertises — around 120 of them — and
 * calls them for real. It exists to show the pivot surfaces under a provider
 * count no hand-written demo reaches, and to make the shape of a real backend's
 * answers (two response formats, no counts, modules that need API keys) visible.
 *
 * The service sends no CORS headers, so the page talks to the `/misp-api`
 * dev-server proxy. Point that elsewhere with `MISP_MODULES_URL`.
 *
 * `window.pivotick` is the graph and `window.mispModules` the catalogue, for the
 * console.
 */
import { Pivotick } from './index'
import type { Node } from './Node'
import type { RawEdge, RawNode } from './interfaces/GraphOptions'
import type { PivotContext, PivotDefinition, PivotResult } from './interfaces/Pivot'
import { expand, link, magnifyingGlass, nodeProperty, sparkles } from './ui/icons'

declare global {
    interface Window {
        pivotick?: Pivotick
        mispModules?: MispModule[]
    }
}

/* ------------------------------------------------------------------ the API */

/** One entry of `GET /modules`. Only what this page reads is typed. */
interface MispModule {
    name: string
    type: string
    mispattributes: {
        input?: string[] | null
        output?: string[] | null
        format?: string
    }
    meta: {
        name?: string
        description?: string
        author?: string
        config?: unknown
        'module-type'?: string[]
    }
}

/** A MISP attribute, as it comes back inside `results`. */
interface MispAttribute {
    uuid?: string
    type?: string
    value?: string
    category?: string
    comment?: string
    to_ids?: boolean
    object_relation?: string
}

interface MispObjectReference {
    object_uuid?: string
    referenced_uuid?: string
    relationship_type?: string
}

interface MispObject {
    uuid?: string
    name?: string
    description?: string
    'meta-category'?: string
    Attribute?: MispAttribute[]
    ObjectReference?: MispObjectReference[]
}

/** What `format: 'misp_standard'` modules put in `results`. */
interface MispStandardResults {
    Attribute?: MispAttribute[]
    Object?: MispObject[]
}

/** What the other modules put there: possible types, and the values under them. */
interface MispSimpleResult {
    types?: string[] | string
    values?: string[] | string
    categories?: string[] | string
    comment?: string
}

/* -------------------------------------------------------------------- knobs */

/** What the toolbar controls. Every provider call below reads it. */
const knobs = {
    /** Where the service is. The dev-server proxy by default. */
    endpoint: '/misp-api',
    /** Milliseconds before a module that never answers is given up on. */
    timeout: 30000,
    /** Whether a MISP object lands as a container carrying its attributes, or flat. */
    objects: 'container' as 'container' | 'flat',
    /** What `onBeforeIngest` does with a batch. */
    ingest: 'off' as 'off' | 'veto' | 'halve',
}

/* ------------------------------------------------------------------ helpers */

/**
 * A stable id for a value too long to be one. Ids are what dedup and rejection
 * memory key on, so they have to survive a re-run — a random id would mean the
 * same whois blob returned twice reads as two different rows.
 */
function digest(text: string): string {
    let h = 2166136261
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    return (h >>> 0).toString(16).padStart(8, '0')
}

/**
 * The id under which one attribute lives on the canvas. Type and value, so the
 * same indicator found by two modules is one node — which is the whole reason
 * dedup has anything to do here.
 */
function attributeId(type: string, value: string): string {
    const trimmed = value.trim()
    return `${type}:${trimmed.length > 120 ? digest(trimmed) : trimmed}`
}

const truncate = (text: string, max: number): string =>
    text.length > max ? `${text.slice(0, max - 1)}…` : text

/** A label that fits beside a node, from a value that may be a whole document. */
const labelFor = (value: string): string => truncate(value.replace(/\s+/g, ' ').trim(), 48)

const asList = (value: unknown): string[] =>
    Array.isArray(value) ? value.map(String) : typeof value === 'string' && value ? [value] : []

/** One node's MISP attribute type, read the way `appliesTo` reads it. */
const typeOf = (node: Node): string => String(node.getData()?.type ?? '')

/**
 * A deterministic uuid for an origin node. Modules echo the attribute they were
 * given — same uuid — and their object references point at it, so a stable uuid
 * per node is what lets those references resolve back to the node on the canvas
 * instead of dangling.
 */
function uuidFor(nodeId: string): string {
    const a = digest(nodeId)
    const b = digest(`${nodeId}/1`)
    const c = digest(`${nodeId}/2`)
    const d = digest(`${nodeId}/3`)
    return `${a}-${b.slice(0, 4)}-4${b.slice(4, 7)}-8${c.slice(0, 3)}-${c.slice(3, 8)}${d.slice(0, 7)}`
}

/** Run `work` over `items` a few at a time, so a multi-node origin is not a burst. */
async function pooled<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length)
    let next = 0
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        for (let i = next++; i < items.length; i = next++) out[i] = await work(items[i])
    })
    await Promise.all(runners)
    return out
}

/* --------------------------------------------------------------- the client */

/** What a module said, before it is read as either of the two shapes. */
type MispResponse = { error?: string, results?: unknown } | false | null

/**
 * One `POST /query`.
 *
 * The payload carries the attribute *twice*: under `attribute`, which newer
 * modules read, and as a bare `<type>: <value>` key, which older ones do. Sending
 * only the modern form silently loses a third of the catalogue — `dns` answers
 * `false` and `hashdd` reports a missing hash — so both go on every call.
 */
async function query(
    module: string,
    type: string,
    value: string,
    uuid: string,
    signal: AbortSignal,
): Promise<MispResponse> {
    const timer = new AbortController()
    const onAbort = (): void => timer.abort(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    const cutoff = window.setTimeout(() => timer.abort(new Error(`${module} did not answer in ${knobs.timeout} ms`)), knobs.timeout)

    try {
        const response = await fetch(`${knobs.endpoint}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: timer.signal,
            body: JSON.stringify({
                module,
                attribute: { type, value, uuid },
                [type]: value,
            }),
        })
        if (!response.ok) throw new Error(`${module}: HTTP ${response.status}`)
        return await response.json() as MispResponse
    } finally {
        window.clearTimeout(cutoff)
        signal.removeEventListener('abort', onAbort)
    }
}

/* ------------------------------------------------------- results into nodes */

/** A fragment under construction, with the uuid map the object references need. */
class Fragment {
    readonly nodes = new Map<string, RawNode>()
    readonly edges = new Map<string, RawEdge>()
    /** MISP uuid → the id of the node it became. */
    readonly byUuid = new Map<string, string>()

    node(raw: RawNode, uuid?: string): string {
        const id = String(raw.id)
        const existing = this.nodes.get(id)
        if (existing) {
            // Two modules can return the same indicator; keep the first, but let the
            // second's children join it rather than be dropped.
            if (raw.children?.length) existing.children = [...(existing.children ?? []), ...raw.children]
        } else {
            this.nodes.set(id, raw)
        }
        if (uuid) this.byUuid.set(uuid, id)
        return id
    }

    edge(from: string, to: string, label: string): void {
        if (from === to) return
        this.edges.set(`${label}:${from}:${to}`, { id: `${label}:${from}:${to}`, from, to, data: { label } })
    }

    result(): PivotResult {
        return { nodes: [...this.nodes.values()], edges: [...this.edges.values()] }
    }
}

/** One MISP attribute as a node. */
function attributeNode(attribute: MispAttribute, source: string): RawNode | undefined {
    const type = String(attribute.type ?? '')
    const value = String(attribute.value ?? '')
    if (!type || !value) return undefined
    return {
        id: attributeId(type, value),
        data: {
            label: labelFor(value),
            type,
            value,
            category: attribute.category,
            comment: attribute.comment || undefined,
            to_ids: attribute.to_ids,
            relation: attribute.object_relation,
            source,
        },
    }
}

/**
 * A MISP object's id. Not its uuid: modules mint a fresh one per call, so keying
 * on it would mean the same CVE looked up twice never dedups. What the object
 * *is* — its name and the attributes it carries — is what holds still.
 */
function objectId(object: MispObject): string {
    const body = (object.Attribute ?? [])
        .map(a => `${a.object_relation ?? ''}=${a.type ?? ''}=${a.value ?? ''}`)
        .sort()
        .join('\n')
    return `object:${object.name ?? 'object'}:${digest(body)}`
}

/** Read a `format: 'misp_standard'` answer into the fragment. */
function readStandard(results: MispStandardResults, source: string, fragment: Fragment): string[] {
    const roots: string[] = []

    for (const attribute of results.Attribute ?? []) {
        const raw = attributeNode(attribute, source)
        if (!raw) continue
        roots.push(fragment.node(raw, attribute.uuid))
    }

    for (const object of results.Object ?? []) {
        const children = (object.Attribute ?? [])
            .map(attribute => ({ attribute, raw: attributeNode(attribute, source) }))
            .filter((entry): entry is { attribute: MispAttribute, raw: RawNode } => Boolean(entry.raw))

        if (knobs.objects === 'flat') {
            // No container: every attribute is a node of its own, and the object
            // itself leaves nothing behind but the uuid its references point at.
            const ids = children.map(entry => fragment.node(entry.raw, entry.attribute.uuid))
            if (object.uuid && ids.length) fragment.byUuid.set(object.uuid, ids[0])
            roots.push(...ids)
            continue
        }

        const id = objectId(object)
        for (const entry of children) fragment.byUuid.set(String(entry.attribute.uuid), entry.raw.id as string)
        roots.push(fragment.node({
            id,
            data: {
                label: object.name ?? 'object',
                type: `object:${object.name ?? 'object'}`,
                category: object['meta-category'],
                comment: object.description,
                source,
            },
            children: children.map(entry => entry.raw),
        }, object.uuid))
    }

    // References the modules declared themselves. These are the real relationships
    // — an object saying which attribute it was derived from — so they are drawn
    // in preference to hanging everything off the origin.
    for (const object of results.Object ?? []) {
        for (const reference of object.ObjectReference ?? []) {
            const from = fragment.byUuid.get(String(reference.object_uuid ?? object.uuid))
            const to = fragment.byUuid.get(String(reference.referenced_uuid))
            if (from && to) fragment.edge(from, to, reference.relationship_type ?? 'related-to')
        }
    }

    return roots
}

/** Read the other shape: `[{ types, values }]`, where `values` may be a bare string. */
function readSimple(results: MispSimpleResult[], source: string, fragment: Fragment): string[] {
    const roots: string[] = []
    for (const entry of results) {
        // `types` is the list of types the value *could* be recorded as; MISP takes
        // the first as the default, and so does this.
        const type = asList(entry.types)[0] ?? 'text'
        for (const value of asList(entry.values)) {
            if (!value.trim()) continue
            roots.push(fragment.node({
                id: attributeId(type, value),
                data: {
                    label: labelFor(value),
                    type,
                    value,
                    category: asList(entry.categories)[0],
                    comment: entry.comment || undefined,
                    source,
                },
            }))
        }
    }
    return roots
}

/**
 * One module's answer as a graph fragment hanging off one origin node.
 *
 * A module that found nothing says so in three different ways — `false`, an empty
 * `results`, or an absent one — and none of them is an error. A module that
 * failed says `{ error }`, and that is thrown: the pivot reports it, which is the
 * honest thing to show for the eighty-odd modules here that want an API key.
 */
function readResponse(response: MispResponse, module: string, origin: Node, fragment: Fragment): void {
    if (!response) return
    if (response.error) throw new Error(`${module}: ${response.error}`)

    const results = response.results
    if (!results) return

    const originId = String(origin.id)
    fragment.byUuid.set(uuidFor(originId), originId)

    const roots = Array.isArray(results)
        ? readSimple(results as MispSimpleResult[], module, fragment)
        : readStandard(results as MispStandardResults, module, fragment)

    // The module echoes back the attribute it was given; that node is the origin,
    // already on the canvas, and an edge from it to itself is nothing.
    fragment.nodes.delete(originId)

    for (const id of roots) {
        if (id === originId) continue
        // Only anchor what the module's own references left unattached.
        const attached = [...fragment.edges.values()].some(edge => edge.from === id || edge.to === id)
        if (!attached) fragment.edge(originId, id, module)
    }
}

/* ----------------------------------------------------------------- catalogue */

const catalogue = {
    /** Every module the service advertises. */
    all: [] as MispModule[],
    /** The expansion ones — the only kind that answers `POST /query` with a graph. */
    expansion: [] as MispModule[],
}

/** A module that names no config parameters needs no API key to be useful. */
const needsConfig = (module: MispModule): boolean => {
    const config = module.meta.config
    if (!config) return false
    if (Array.isArray(config)) return config.length > 0
    return Object.keys((config as { params?: object }).params ?? {}).length > 0
}

const inputsOf = (module: MispModule): string[] => module.mispattributes.input ?? []

async function loadCatalogue(): Promise<void> {
    const response = await fetch(`${knobs.endpoint}/modules`)
    if (!response.ok) throw new Error(`GET /modules: HTTP ${response.status}`)
    catalogue.all = await response.json() as MispModule[]
    catalogue.expansion = catalogue.all
        .filter(module => module.type === 'expansion' && inputsOf(module).length > 0)
        .sort((a, b) => a.name.localeCompare(b.name))
    window.mispModules = catalogue.all
}

/* ----------------------------------------------------------------- families */

/**
 * MISP has some seventy attribute types; a style each would be a wall of noise.
 * They are drawn by family instead, while `data.type` stays the real MISP type —
 * which is what `appliesTo` matches on.
 */
const FAMILIES: Array<[family: string, test: RegExp]> = [
    ['hash', /^(md5|sha\d+|sha3-\d+|ssdeep|imphash|impfuzzy|authentihash|telfhash|vhash|tlsh|pehash|cdhash|x509-fingerprint-.*)$/],
    ['file', /^(filename|attachment|malware-sample|malware-filename|mime-type|pattern-in-file|size-in-bytes)/],
    ['network', /^(ip-|ip$|domain|hostname|url|uri|link|port|mac-address|AS$|asn|onion-address|email-dst-display-name|dns-soa-email|cidr|http-method|user-agent|hex|windows-service-name)/],
    ['identity', /^(email|target-|github-username|twitter-id|phone-number|whois-|first-name|last-name|full-name|passport|identity-card-number|nationality|jabber-id|pgp-)/],
    ['vulnerability', /^(vulnerability|cpe|weakness|attack-pattern)/],
    ['financial', /^(btc|xmr|dash|bic|iban|bin|cc-number|prtn|phone)/],
    ['detection', /^(yara|sigma|snort|suricata|stix2-pattern|zeek|bro|eql|kusto-query|mime|pattern-in-)/],
    ['object', /^object:/],
]

function familyOf(type: string): string {
    for (const [family, test] of FAMILIES) if (test.test(type)) return family
    return 'other'
}

const FAMILY_STYLES: Record<string, { shape: 'circle' | 'square' | 'triangle' | 'hexagon', color: string, size: number }> = {
    network: { shape: 'circle', color: '#88c0d0', size: 16 },
    hash: { shape: 'square', color: '#8fbcbb', size: 13 },
    file: { shape: 'triangle', color: '#d8dee9', size: 15 },
    identity: { shape: 'circle', color: '#81a1c1', size: 15 },
    vulnerability: { shape: 'hexagon', color: '#bf616a', size: 20 },
    financial: { shape: 'square', color: '#ebcb8b', size: 16 },
    detection: { shape: 'triangle', color: '#a3be8c', size: 15 },
    object: { shape: 'hexagon', color: '#4c566a', size: 22 },
    other: { shape: 'circle', color: '#9aa5b1', size: 12 },
}

/** An icon per family, so a list of a hundred entries is not a hundred identical rows. */
const FAMILY_ICONS: Record<string, string> = {
    network: link,
    hash: nodeProperty,
    file: nodeProperty,
    identity: nodeProperty,
    vulnerability: sparkles,
    financial: sparkles,
    detection: magnifyingGlass,
    other: expand,
}

/** A module is drawn under whichever family most of its inputs belong to. */
function moduleFamily(module: MispModule): string {
    const counts = new Map<string, number>()
    for (const input of inputsOf(module)) {
        const family = familyOf(input)
        counts.set(family, (counts.get(family) ?? 0) + 1)
    }
    let best = 'other'
    let top = 0
    for (const [family, n] of counts) if (n > top) { best = family; top = n }
    return best
}

/* --------------------------------------------------------------- the canvas */

/**
 * Real, public, safe indicators — the seed has to be enrichable or the page shows
 * nothing but empty results. `.example` domains and RFC 5737 addresses, which the
 * hand-written demo uses, resolve to nothing anywhere.
 *
 * Ids follow the same `type:value` scheme the results do, so a module returning
 * an indicator that is already here dedups against it.
 */
const SEED: Array<{ type: string, value: string, label?: string }> = [
    { type: 'domain', value: 'circl.lu' },
    { type: 'domain', value: 'dbltest.com' },
    { type: 'hostname', value: 'www.circl.lu' },
    { type: 'ip-src', value: '8.8.8.8' },
    { type: 'ip-dst', value: '1.1.1.1' },
    { type: 'url', value: 'https://www.circl.lu/services/misp-malware-information-sharing-platform/' },
    { type: 'vulnerability', value: 'CVE-2021-44228' },
    { type: 'vulnerability', value: 'CVE-2014-0160' },
    { type: 'md5', value: '44d88612fea8a8f36de82e1278abb02f' },
    { type: 'sha1', value: '3395856ce81f2b7382dee72602f798b642f14140' },
    { type: 'sha256', value: '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f' },
    { type: 'filename', value: 'eicar.com' },
    { type: 'email-src', value: 'info@circl.lu' },
    { type: 'whois-registrant-email', value: 'hostmaster@circl.lu' },
    { type: 'btc', value: '1HB5XMLmzFVj8ALj6mfBsbifRoD4miY36v' },
    { type: 'onion-address', value: 'facebookwkhpilnemxj7asaniu7vnjjbiltxjqhye3mhbshg7kx5tfyd.onion' },
    { type: 'AS', value: 'AS197692' },
    { type: 'github-username', value: 'MISP' },
    { type: 'phone-number', value: '+35224786060' },
    { type: 'text', value: 'Luxembourg' },
    // The syntax validators need no network and no key, so they answer every time —
    // useful for driving the surfaces when the machine is offline.
    {
        type: 'sigma',
        label: 'sigma rule',
        value: 'title: Suspicious PowerShell\nlogsource:\n  product: windows\ndetection:\n  selection:\n    Image|endswith: \\powershell.exe\n  condition: selection',
    },
    {
        type: 'yara',
        label: 'yara rule',
        value: 'rule eicar { strings: $a = "EICAR-STANDARD-ANTIVIRUS-TEST-FILE" condition: $a }',
    },
    { type: 'stix2-pattern', label: 'stix2 pattern', value: '[ipv4-addr:value = \'8.8.8.8\']' },
]

const seedId = (type: string, value: string): string => attributeId(type, value)

const SEED_NODES: RawNode[] = SEED.map(entry => ({
    id: seedId(entry.type, entry.value),
    data: {
        label: entry.label ?? labelFor(entry.value),
        type: entry.type,
        value: entry.value,
        source: 'seed',
    },
}))

/**
 * The one seed node of a given type. The rules are far too long to be named by
 * their id in the edge list below — an id that long is a digest, not a value.
 */
const seedOf = (type: string): string =>
    String(SEED_NODES.find(node => node.data?.type === type)?.id ?? type)

/** A plausible shape, so the seed reads as a case rather than a bag of indicators. */
const SEED_EDGES: RawEdge[] = ([
    [seedOf('sigma'), 'filename:eicar.com', 'detects'],
    [seedOf('yara'), 'filename:eicar.com', 'detects'],
    [seedOf('stix2-pattern'), 'ip-src:8.8.8.8', 'matches'],
    ['domain:circl.lu', 'hostname:www.circl.lu', 'has-host'],
    ['hostname:www.circl.lu', 'url:https://www.circl.lu/services/misp-malware-information-sharing-platform/', 'serves'],
    ['domain:circl.lu', 'email-src:info@circl.lu', 'contact'],
    ['domain:circl.lu', 'whois-registrant-email:hostmaster@circl.lu', 'registrant'],
    ['domain:circl.lu', 'AS:AS197692', 'announced-by'],
    ['domain:circl.lu', 'phone-number:+35224786060', 'contact'],
    ['domain:circl.lu', 'text:Luxembourg', 'located-in'],
    ['domain:circl.lu', 'github-username:MISP', 'publishes'],
    ['filename:eicar.com', 'md5:44d88612fea8a8f36de82e1278abb02f', 'is'],
    ['filename:eicar.com', 'sha1:3395856ce81f2b7382dee72602f798b642f14140', 'is'],
    ['filename:eicar.com', 'sha256:275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f', 'is'],
    ['ip-src:8.8.8.8', 'domain:circl.lu', 'resolved-from'],
    ['ip-dst:1.1.1.1', 'domain:dbltest.com', 'resolved-from'],
    ['vulnerability:CVE-2021-44228', 'url:https://www.circl.lu/services/misp-malware-information-sharing-platform/', 'affects'],
    ['vulnerability:CVE-2014-0160', 'hostname:www.circl.lu', 'affects'],
    ['btc:1HB5XMLmzFVj8ALj6mfBsbifRoD4miY36v', 'onion-address:facebookwkhpilnemxj7asaniu7vnjjbiltxjqhye3mhbshg7kx5tfyd.onion', 'paid-to'],
] as Array<[string, string, string]>).map(([from, to, label]) => ({
    id: `seed:${from}:${to}`,
    from,
    to,
    data: { label },
}))

/* ----------------------------------------------------------------- providers */

/** How many origin nodes are queried at once, so a wide selection is not a burst. */
const CONCURRENCY = 4

/** Run one module over every origin node and merge what comes back. */
async function runModule(module: MispModule, nodes: Node[], ctx: PivotContext): Promise<PivotResult> {
    const fragment = new Fragment()
    const errors: string[] = []
    const accepted = inputsOf(module)

    await pooled(nodes.filter(node => accepted.includes(typeOf(node))), CONCURRENCY, async node => {
        const type = typeOf(node)
        const value = String(node.getData()?.value ?? node.id)
        try {
            const response = await query(module.name, type, value, uuidFor(String(node.id)), ctx.signal)
            readResponse(response, module.name, node, fragment)
        } catch (error) {
            if (ctx.signal.aborted) throw error
            errors.push(error instanceof Error ? error.message : String(error))
        }
    })

    // One origin failing out of five is a partial answer, not a failure; all of
    // them failing is a failure, and the pane should say why.
    if (errors.length && fragment.nodes.size === 0) throw new Error(errors[0])
    return fragment.result()
}

/**
 * One pivot per expansion module.
 *
 * No `summarize`. misp-modules has no "how much is out there" call — the only
 * question it answers is the expensive one — so every entry here is the bare Run
 * path, and the panel cannot advertise a count for any of them. That is the
 * honest shape of this backend, and half of what this page is here to show.
 */
function pivotFor(module: MispModule): PivotDefinition {
    const accepted = inputsOf(module)
    const family = moduleFamily(module)
    return {
        id: `misp:${module.name}`,
        label: module.meta.name?.trim() || module.name,
        icon: FAMILY_ICONS[family] ?? expand,
        // A module reads one attribute type, so it answers per node: a selection
        // holding an IP and a domain offers both modules that take an IP and modules
        // that take a domain, each against its own share of it.
        appliesTo: nodes => nodes.filter(node => accepted.includes(typeOf(node))),
        fetch: (nodes, _narrowing, ctx) => runModule(module, nodes, ctx),
    }
}

/**
 * There is deliberately no "run everything" pivot here any more.
 *
 * There used to be: one pivot whose narrowing facet was a checkbox list of every
 * applicable module, because running several at once had nowhere else to live. The
 * panel now holds that itself — tick the providers, run the tray — so the meta-pivot
 * was a second way to do the same thing, and the louder of the two: its facet alone
 * stood taller than the panel and pushed every real provider below the fold.
 */

/* --------------------------------------------------------------------- boot */

const bar = document.getElementById('devbar')!
const app = document.getElementById('app')!

function fail(message: string): void {
    app.innerHTML = ''
    const box = document.createElement('div')
    box.className = 'devbar-error'
    box.innerHTML = `<strong>misp-modules unreachable.</strong> ${message}`
        + '<p>The page talks to the <code>/misp-api</code> dev-server proxy, which forwards to'
        + ' <code>http://127.0.0.1:6677</code>. Start the service, or set <code>MISP_MODULES_URL</code>'
        + ' and restart <code>npm run dev</code>.</p>'
    app.append(box)
}

async function main(): Promise<void> {
    try {
        await loadCatalogue()
    } catch (error) {
        fail(error instanceof Error ? error.message : String(error))
        return
    }

    // Registered up front rather than after the first paint, so the rail button and
    // every rim badge are already right when the graph first draws.
    const pivots = catalogue.expansion.map(pivotFor)

    const graph = new Pivotick(
        app,
        { nodes: SEED_NODES, edges: SEED_EDGES },
        {
            pivots,
            // 119 providers is well past the point where a badge each is readable.
            pivotRimBadge: 'summary',
            render: {
                nodeTypeAccessor: node => familyOf(typeOf(node)),
                nodeStyleMap: FAMILY_STYLES,
                defaultNodeStyle: {
                    size: 14,
                    color: '#8f9aa8',
                    text: node => String(node.getData()?.label ?? ''),
                    textVerticalShift: -1.4,
                    textTruncate: false,
                },
                defaultEdgeStyle: { markerEnd: 'arrow' },
            },
            UI: {
                mode: 'full',
                sidebar: { collapsed: true },
                dock: { open: false },
            },
            callbacks: {
                onBeforeIngest: context => {
                    if (knobs.ingest === 'veto') {
                        graph.notifier.warning('Ingest vetoed', `onBeforeIngest refused ${context.pivotId} — dev toolbar`)
                        return false
                    }
                    if (knobs.ingest === 'halve') {
                        const kept = context.candidates.nodes.filter((_, i) => i % 2 === 0)
                        graph.notifier.info('Ingest narrowed',
                            `${kept.length} of ${context.candidates.nodes.length} nodes kept`)
                        return { accept: true, nodes: kept }
                    }
                    return true
                },
            },
        },
    )

    window.pivotick = graph

    // The rim carries one badge per node saying how many of the catalogue's modules
    // accept its type — 51 on an ip-src, 2 on an AS. Nothing declares it: with no count
    // endpoint there is no total to declare, so the library counts what applies.
    // Clicking it opens the panel, which at this provider count is always the answer.

    buildToolbar(graph)
}

/* ------------------------------------------------------------------- toolbar */

function field(label: string, control: HTMLElement): HTMLLabelElement {
    const wrap = document.createElement('label')
    wrap.className = 'devbar-field'
    const text = document.createElement('span')
    text.textContent = label
    wrap.append(text, control)
    return wrap
}

function select(
    options: Array<[value: string, label: string]>,
    initial: string,
    onChange: (value: string) => void,
): HTMLSelectElement {
    const el = document.createElement('select')
    for (const [value, label] of options) {
        const option = document.createElement('option')
        option.value = value
        option.textContent = label
        el.append(option)
    }
    el.value = initial
    el.addEventListener('change', () => onChange(el.value))
    return el
}

function button(label: string, title: string, onClick: () => void): HTMLButtonElement {
    const el = document.createElement('button')
    el.type = 'button'
    el.textContent = label
    el.title = title
    el.addEventListener('click', onClick)
    return el
}

function buildToolbar(graph: Pivotick): void {
    const registered = new Map<string, () => void>()

    /**
     * Re-register under the "which modules" knob.
     */
    const setScope = (scope: string): void => {
        for (const off of registered.values()) off()
        registered.clear()
        const wanted = scope === 'nokey'
            ? catalogue.expansion.filter(module => !needsConfig(module))
            : catalogue.expansion
        for (const module of wanted) {
            const def = pivotFor(module)
            registered.set(def.id, graph.pivots.register(def))
        }
        graph.notifier.info('Modules', `${wanted.length} expansion modules registered`)
    }

    const ceiling = document.createElement('input')
    ceiling.type = 'number'
    ceiling.min = '1'
    ceiling.step = '50'
    ceiling.value = String(graph.pivots.candidateCeiling)
    ceiling.addEventListener('change', () => {
        graph.pivots.candidateCeiling = Math.max(1, Number(ceiling.value) || 1)
    })

    const endpoint = document.createElement('input')
    endpoint.type = 'text'
    endpoint.className = 'devbar-endpoint'
    endpoint.value = knobs.endpoint
    endpoint.title = 'Where POST /query and GET /modules go. The dev-server proxy by default.'
    endpoint.addEventListener('change', () => { knobs.endpoint = endpoint.value.replace(/\/$/, '') })

    const status = document.createElement('span')
    status.className = 'devbar-status'

    const paintStatus = (): void => {
        const staged = graph.pivots.staged()
        const rows = staged.reduce((sum, set) => sum + set.nodes.length + set.edges.length, 0)
        const marked = staged.reduce((sum, set) => sum
            + set.nodes.filter(candidate => candidate.state === 'marked').length
            + set.edges.filter(edge => edge.state === 'marked').length, 0)
        status.textContent = `${graph.pivots.size} pivots · ${staged.length} staged · ${rows} rows`
            + ` · ${marked} marked · ${graph.history.entries().length} entries`
    }

    graph.pivots.on(paintStatus)
    graph.history.on(paintStatus)

    bar.append(
        field('Service', endpoint),
        field('Modules', select(
            [['all', `all expansion (${catalogue.expansion.length})`],
                ['nokey', `no API key (${catalogue.expansion.filter(m => !needsConfig(m)).length})`]],
            'all',
            setScope,
        )),
        field('Timeout', select(
            [['10000', '10 s'], ['30000', '30 s'], ['60000', '60 s'], ['120000', '2 min']],
            String(knobs.timeout),
            value => { knobs.timeout = Number(value) },
        )),
        field('Objects', select(
            [['container', 'as containers'], ['flat', 'flattened']],
            knobs.objects,
            value => { knobs.objects = value as typeof knobs.objects },
        )),
        field('Ingest', select(
            [['off', 'as asked'], ['veto', 'veto every batch'], ['halve', 'keep every other node']],
            knobs.ingest,
            value => { knobs.ingest = value as typeof knobs.ingest },
        )),
        field('Ceiling', ceiling),
        button('Undo', 'graph.history.undo() — take the newest entry back', () => {
            if (!graph.history.undo().length) graph.notifier.info('Undo', 'Nothing left to undo')
        }),
        button('Redo', 'graph.history.redo() — put it back, no refetch', () => {
            if (!graph.history.redo().length) graph.notifier.info('Redo', 'Nothing to redo')
        }),
        button('Cancel', 'graph.pivots.cancel() — abort every call in flight', () => graph.pivots.cancel()),
        button('Log', 'Dump the catalogue, the staged sets and the run log to the console', () => {
            console.log('catalogue', catalogue.all)
            console.log('staged', graph.pivots.staged())
            console.log('history', graph.history.entries())
        }),
        button('Reload', 'Start over: rejection memory and the run log are session-only', () => location.reload()),
        status,
    )

    bar.append(buildSheet())
    paintStatus()
}

/** The catalogue, filterable — with a hundred modules a plain list is unreadable. */
function buildSheet(): HTMLElement {
    const sheet = document.createElement('details')
    sheet.className = 'devbar-sheet'

    const summary = document.createElement('summary')
    const withKey = catalogue.expansion.filter(needsConfig).length
    summary.textContent = `${catalogue.expansion.length} expansion modules`
        + ` (${withKey} want an API key) · ${catalogue.all.length} in the catalogue`
    sheet.append(summary)

    const filter = document.createElement('input')
    filter.type = 'search'
    filter.placeholder = 'filter by name or input type…'
    filter.className = 'devbar-filter'
    sheet.append(filter)

    const list = document.createElement('ul')
    sheet.append(list)

    const paint = (): void => {
        const needle = filter.value.trim().toLowerCase()
        list.innerHTML = ''
        for (const module of catalogue.expansion) {
            const inputs = inputsOf(module)
            const haystack = `${module.name} ${module.meta.name ?? ''} ${inputs.join(' ')}`.toLowerCase()
            if (needle && !haystack.includes(needle)) continue
            const item = document.createElement('li')
            const name = document.createElement('strong')
            name.textContent = module.meta.name?.trim() || module.name
            const note = needsConfig(module) ? ' · needs an API key' : ''
            item.append(name, document.createTextNode(
                ` — ${inputs.join(', ')} → ${module.mispattributes.format ?? 'simple'}${note}`,
            ))
            list.append(item)
        }
    }

    filter.addEventListener('input', paint)
    paint()
    return sheet
}

void main()
