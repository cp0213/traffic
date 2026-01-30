import type { Edge, Node } from '@xyflow/react';
import type { TrafficNodeData } from './types';

/**
 * Basic auto-layout based on levels (BFS)
 */
export const autoLayoutNodes = (nodes: Node<TrafficNodeData>[], edges: Edge[]): Node<TrafficNodeData>[] => {
    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    nodes.forEach(n => {
        adj.set(n.id, []);
        inDegree.set(n.id, 0);
    });

    edges.forEach(e => {
        adj.get(e.source)?.push(e.target);
        inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    });

    const levels = new Map<string, number>();
    const queue: string[] = [];

    nodes.forEach(n => {
        if (inDegree.get(n.id) === 0) {
            levels.set(n.id, 0);
            queue.push(n.id);
        }
    });

    let head = 0;
    while (head < queue.length) {
        const u = queue[head++];
        const l = levels.get(u)!;
        adj.get(u)?.forEach(v => {
            if (!levels.has(v) || levels.get(v)! < l + 1) {
                levels.set(v, l + 1);
                queue.push(v);
            }
        });
    }

    nodes.forEach(n => {
        if (!levels.has(n.id)) levels.set(n.id, 0);
    });

    const levelCounts = new Map<number, number>();
    return nodes.map(n => {
        const l = levels.get(n.id) || 0;
        const c = levelCounts.get(l) || 0;
        levelCounts.set(l, c + 1);
        return {
            ...n,
            position: { x: l * 400, y: c * 180 } // Slightly increased vertical gap for better readability
        };
    });
};
