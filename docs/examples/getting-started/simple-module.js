import { Pivotick } from 'pivotick'
import 'pivotick/dist/pivotick.css'

const app = new Pivotick({
    container: document.getElementById('app'),
    data: {
        nodes: [
            { id: 1, data: { label: 'A' } },
            { id: 2, data: { label: 'B' } }
        ],
        edges: [
            { from: 1, to: 2 }
        ]
    }
})