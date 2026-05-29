export interface NoteOptions {
    id?: string
    x?: number
    y?: number
    width?: number
    height?: number
    content?: string
    color?: string
}

export class Note {

    public id: string

    public x: number
    public y: number

    public width: number
    public height: number

    public content: string
    public color: string

    private graphElement?: SVGGElement
    private editing: boolean

    public constructor(options: NoteOptions = {}) {
        this.id = options.id ?? crypto.randomUUID()

        this.x = options.x ?? 0
        this.y = options.y ?? 0

        this.width = options.width ?? 220
        this.height = options.height ?? 160

        this.content = options.content ?? ''
        this.color = options.color ?? '#FDE68A'

        this.editing = false
    }

    public setPosition(x: number, y: number): void {
        this.x = x
        this.y = y
    }

    public setSize(width: number, height: number): void {
        this.width = width
        this.height = height
    }

    public setContent(content: string): void {
        this.content = content
    }

    public setColor(color: string): void {
        this.color = color
    }

    public setGraphElement(el: SVGGElement): void {
        this.graphElement = el
    }

    public getGraphElement(): SVGGElement | undefined {
        return this.graphElement
    }

    public isEditing(): boolean {
        return this.editing
    }

    public setEditing(editing: boolean): void {
        this.editing = editing
    }
}