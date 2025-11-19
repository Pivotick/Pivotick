const options = {
    render: {
        renderNode: (node: Node): HTMLElement | string | void => {
            const size = 12
            const color = '#09f'
            const style = [
                'display: block',
                `width: ${size}px`,
                `height: ${size}px`,
                `background-color: ${color}`,
                'border: 2px solid #fff',
                'border-radius: 50%',
                'opacity: 1',
            ].join(';')

            return `<span style="${style}"></span>`
        }
    }
}