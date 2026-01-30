import type { Edge, Node } from '@xyflow/react';
import type { TrafficNodeData, EvaluationResult } from './types';

export function evaluateTraffic(
    nodes: Node<TrafficNodeData>[],
    edges: Edge[],
    multiplier: number
): Map<string, EvaluationResult> {
    const results = new Map<string, EvaluationResult>();

    // 1. Initialize Map
    const inDegree = new Map<string, number>();
    const incomingEdges = new Map<string, string[]>(); // target -> source[]

    nodes.forEach(node => {
        inDegree.set(node.id, 0);
        incomingEdges.set(node.id, []);
    });

    edges.forEach(edge => {
        // Only count edges that connect valid nodes
        if (inDegree.has(edge.target) && inDegree.has(edge.source)) {
            inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
            incomingEdges.get(edge.target)?.push(edge.source);
        }
    });

    // 2. Topological Sort (Kahn's Algorithm)
    const queue: string[] = [];
    nodes.forEach(node => {
        if ((inDegree.get(node.id) || 0) === 0) {
            queue.push(node.id);
        }
    });

    const sortedOrder: string[] = [];
    // Clone inDegree to mutate
    const currentInDegree = new Map(inDegree);

    while (queue.length > 0) {
        const u = queue.shift()!;
        sortedOrder.push(u);

        // Find outgoing edges
        edges.filter(e => e.source === u).forEach(e => {
            const v = e.target;
            if (currentInDegree.has(v)) {
                currentInDegree.set(v, (currentInDegree.get(v) || 0) - 1);
                if (currentInDegree.get(v) === 0) {
                    queue.push(v);
                }
            }
        });
    }

    // Check for cycles (if sortedOrder.length < nodes.length)
    // If cycle, we might not reach some nodes. 
    // We'll proceed with what we have or handle cycles specifically?
    // For now, assume DAG. If cycle, those nodes won't be processed in this linear pass properly
    // but we can default them to 0 or handle simplistic loop.

    // 3. Process Flow
    const flowMap = new Map<string, number>();

    sortedOrder.forEach(nodeId => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        let flow = 0;
        const sources = incomingEdges.get(nodeId) || [];

        if (sources.length === 0) {
            // Inference: No incoming edges means it's an entry node
            // Entry Node generates its own traffic from baseline dailyQPS
            flow = (node.data.dailyQPS || 0) * multiplier;
        } else {
            // Dependent Node: Only carries flow from its upstream sources
            sources.forEach(sourceId => {
                flow += (flowMap.get(sourceId) || 0);
            });
        }

        // Store calculated flow (Demand)
        flowMap.set(nodeId, flow);

        // Detect Bottlenecks
        let isBottleneck = false;
        let bottleneckType: 'none' | 'rate_limit' | 'max_capacity' = 'none';

        if (flow > node.data.maxQPS) {
            isBottleneck = true;
            bottleneckType = 'max_capacity';
        } else if (flow > node.data.rateLimitQPS) {
            isBottleneck = true;
            bottleneckType = 'rate_limit';
        }

        results.set(nodeId, {
            nodeId,
            currentQPS: flow,
            isBottleneck,
            bottleneckType
        });
    });

    return results;
}
