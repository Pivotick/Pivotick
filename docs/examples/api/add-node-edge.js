
import { Node, Edge } from '../../../dist/pivotick.js'

// #region loaded
function loaded(graph) {
    let i = graph.getMutableNodes().length
    addNode(i++, graph)
    setInterval(() => {
        if (i < 10) {
            addNode(i++, graph)
        }
    }, 1500)
}
// #endregion loaded

// #region addnode
async function addNode(counter, graph) {
    const newNode = new Node(`n-${counter}`, { label: `Node ${counter}` })
    
    const existingNodes = graph.getMutableNodes()
    const randomIndex = Math.floor(Math.random() * existingNodes.length)
    const randomNode = existingNodes[randomIndex]
    
    const newEdge = new Edge(`e-${counter}`, randomNode, newNode)
    
    graph.addNode(newNode)
    graph.addEdge(newEdge)
    
    // Restart physics by nudging the graph a bit
    graph.simulation.reheat(0.7)
    await graph.simulation.waitForSimulationStop()
    graph.renderer.fitAndCenter()
}
// #endregion addnode

export { loaded }