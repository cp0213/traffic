import type { Edge, Node } from '@xyflow/react';
import type { TrafficNodeData } from './types';
import type { TrafficFlow } from './excel';

export const exportToJSON = (activeTabId: string, tabs: any[], currentNodes: Node<TrafficNodeData>[], currentEdges: Edge[], multiplier: number) => {
    const currentTab = {
        id: activeTabId,
        name: tabs.find(t => t.id === activeTabId)?.name || 'Flow',
        nodes: currentNodes,
        edges: currentEdges
    };
    const data = { ...currentTab, multiplier };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `traffic-flow-${currentTab.name}.json`;
    a.click();
};

export const parseJSONFile = async (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                resolve(json);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('File reading failed'));
        reader.readAsText(file);
    });
};
