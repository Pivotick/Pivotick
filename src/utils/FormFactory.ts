import TomSelect from 'tom-select'

export type FieldType =
    | 'select'
    | 'multiselect'
    | 'checkbox'
    | 'text'
    | 'numberRange';

export interface FieldOption {
    label: string
    value: string
}

export interface FieldConfig {
    key: string
    label: string
    type: FieldType
    options?: FieldOption[]
    placeholder?: string
    defaultValue?: FormValue
    allowEmpty?: boolean
}

export interface FormConfig {
    fields: FieldConfig[]
}

export type FormValue = string | string[] | number | number[] | boolean | undefined | {min: number | undefined, max: number | undefined}
export type FormValues = Record<string, FormValue>

export class FormFactory {

    static createForm(config: FormConfig): HTMLFormElement {
        const form = document.createElement('form')
        form.className = 'pvt-form'

        config.fields.forEach(field => {
            form.appendChild(this.createField(field))
        })

        return form
    }

    static getValues(form: HTMLFormElement): FormValues {
        const values: FormValues = {}

        const fields = form.querySelectorAll('[data-field-key]')

        fields.forEach(el => {
            const key = el.getAttribute('data-field-key')!
            const type = el.getAttribute('data-field-type')!

            switch (type) {
                case 'text':
                    values[key] = (el as HTMLInputElement).value || undefined
                    break

                case 'select':
                    values[key] = (el as HTMLSelectElement).value || undefined
                    break

                case 'multiselect':
                    values[key] = Array.from(
                        (el as HTMLSelectElement).selectedOptions
                    ).map(o => o.value)
                    break

                case 'checkbox':
                    values[key] = (el as HTMLInputElement).checked
                    break

                case 'numberRange':
                    { const min = (el.querySelector('.min') as HTMLInputElement).value
                    const max = (el.querySelector('.max') as HTMLInputElement).value
                    values[key] = {
                        min: min ? Number(min) : undefined,
                        max: max ? Number(max) : undefined,
                    }
                    break }
            }
        })

        return values
    }

    static clear(form: HTMLFormElement) {
        form.reset()
    }

    static createField(field: FieldConfig): HTMLElement {
        const wrapper = document.createElement('div')
        wrapper.className = 'pvt-form-element'

        const label = document.createElement('label')
        label.htmlFor = `pvt-form-element-${field.key}`
        label.textContent = this.niceLabelFromKey(field.label)
        wrapper.appendChild(label)

        switch (field.type) {
            case 'select':
                wrapper.appendChild(this.createSelect(field))
                break

            case 'multiselect':
                wrapper.appendChild(this.createMultiSelect(field))
                break

            case 'checkbox':
                wrapper.appendChild(this.createCheckbox(field))
                break

            case 'text':
                wrapper.appendChild(this.createText(field))
                break

            case 'numberRange':
                wrapper.appendChild(this.createNumberRange(field))
                break
        }

        return wrapper
    }

    private static baseAttrs(el: HTMLElement, field: FieldConfig) {
        el.id = `pvt-form-element-${field.key}`
        el.setAttribute('data-field-key', field.key)
        el.setAttribute('data-field-type', field.type)
    }

    private static buildSelect(field: FieldConfig): HTMLSelectElement {
        const select = document.createElement('select')
        this.baseAttrs(select, field)

        if (field.allowEmpty) {
            const placeholder = document.createElement('option')
            placeholder.value = ''
            placeholder.textContent = ''
            placeholder.selected = true
            select.appendChild(placeholder)
        }

        field.options?.forEach(opt => {
            const o = document.createElement('option')
            o.value = opt.value
            o.textContent = opt.label

            if (
                field.defaultValue &&
                (Array.isArray(field.defaultValue)
                    ? (field.defaultValue as string[]).includes(opt.value)
                    : field.defaultValue === opt.value)
            ) {
                o.selected = true
            }

            select.appendChild(o)
        })

        return select
    }

    private static createSelect(field: FieldConfig): HTMLSelectElement {
        const select = this.buildSelect(field)

        requestAnimationFrame(() => {
            const tomSelectSettings = {
                plugins: {
                    clear_button: {
                        title: 'Remove all selected options',
                    },
                },
            }
            new TomSelect(select, tomSelectSettings)
        })
        return select
    }

    private static createMultiSelect(field: FieldConfig): HTMLSelectElement {
        const select = this.buildSelect(field)
        select.multiple = true

        requestAnimationFrame(() => {
            const tomSelectSettings = {
                plugins: {
                    checkbox_options: {
                        checkedClassNames: ['pvt-ts-checked'],
                        uncheckedClassNames: ['pvt-ts-unchecked'],
                    },
                    clear_button: {
                        title: 'Remove all selected options',
                    },
                    remove_button: {
                        title: 'Remove this item',
                    }
                },
            }
            new TomSelect(select, tomSelectSettings)
        })

        return select
    }

    private static createCheckbox(field: FieldConfig): HTMLInputElement {
        const input = document.createElement('input')
        input.type = 'checkbox'

        if (field.defaultValue === true) {
            input.checked = true
        }
        this.baseAttrs(input, field)
        return input
    }

    private static createText(field: FieldConfig): HTMLInputElement {
        const input = document.createElement('input')
        input.type = 'text'
        input.placeholder = field.placeholder ?? ''
        this.baseAttrs(input, field)

        if (field.defaultValue) {
            input.value = String(field.defaultValue)
        }

        return input
    }

    private static createNumberRange(field: FieldConfig): HTMLElement {
        const container = document.createElement('div')
        container.className = 'pvt-number-range'
        this.baseAttrs(container, field)

        const min = document.createElement('input')
        min.type = 'number'
        min.placeholder = 'Min'
        min.className = 'min'

        const max = document.createElement('input')
        max.type = 'number'
        max.placeholder = 'Max'
        max.className = 'max'

        const dv =
            typeof field.defaultValue === 'object' && field.defaultValue !== null
                ? (field.defaultValue as { min?: number | undefined; max?: number | undefined })
                : undefined

        if (dv?.min != null) min.value = String(dv.min)
        if (dv?.max != null) max.value = String(dv.max)

        container.append(min, max)
        return container
    }

    private static niceLabelFromKey(key: string): string {
        const words = key
            .replace(/([A-Z])/g, ' $1') // camelCase -> space
            .replace(/[_-]+/g, ' ')     // snake_case or kebab-case -> space
            .trim()
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        return words.join(' ')
    }
}
