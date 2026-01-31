import * as XLSX from 'xlsx';
import type { Edge, Node } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import type { TrafficNodeData } from './types';
import { autoLayoutNodes } from './layout';

export interface TrafficFlow {
    id: string;
    name: string;
    nodes: Node<TrafficNodeData>[];
    edges: Edge[];
}

export const exportToExcel = (tabs: TrafficFlow[], activeTabId: string, currentNodes: Node<TrafficNodeData>[], currentEdges: Edge[], multiplier: number) => {
    const syncedTabs = tabs.map(t => t.id === activeTabId ? { ...t, nodes: currentNodes, edges: currentEdges } : t);

    const nodesRows: any[] = [];
    const edgesRows: any[] = [];

    syncedTabs.forEach(tab => {
        const idMap = new Map<string, number>();

        tab.nodes.forEach((n, idx) => {
            const simpleId = idx + 1;
            idMap.set(n.id, simpleId);
            nodesRows.push({
                'ID': simpleId,
                'Tab Name': tab.name,
                'Microservice': n.data.microservice,
                'API': n.data.api,
                'Baseline QPS': n.data.dailyQPS,
                'Current Evaluated QPS': n.data.currentQPS || (n.data.dailyQPS * multiplier),
                'Max QPS': n.data.maxQPS,
                'Rate Limit QPS': n.data.rateLimitQPS,
                'Status': n.data.status || 'normal',
                'Owner': n.data.owner
            });
        });

        tab.edges.forEach(e => {
            const sourceNode = tab.nodes.find(sn => sn.id === e.source);
            const targetNode = tab.nodes.find(tn => tn.id === e.target);
            const fromSimpleId = idMap.get(e.source);
            const toSimpleId = idMap.get(e.target);

            if (sourceNode && targetNode && fromSimpleId && toSimpleId) {
                edgesRows.push({
                    'From ID': fromSimpleId,
                    'To ID': toSimpleId,
                    'Tab Name': tab.name,
                    'From Microservice': sourceNode.data.microservice,
                    'To Microservice': targetNode.data.microservice,
                    'Call Multiplier': (e.data as any)?.multiplier || 1
                });
            }
        });
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(nodesRows), 'Nodes');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(edgesRows), 'Edges');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ 'Global Multiplier': multiplier }]), 'Config');

    XLSX.writeFile(wb, `traffic-evaluation-all.xlsx`);
};

export const parseExcelFile = async (
    file: File,
    runEvaluation: (currentNodes: Node<TrafficNodeData>[], currentEdges: Edge[], mult: number) => Node<TrafficNodeData>[]
): Promise<{ tabs: TrafficFlow[], multiplier: number }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = evt.target?.result;
                if (!data) throw new Error('Data read error');

                const wb = XLSX.read(data, { type: 'array' });
                const wsNodes = wb.Sheets['Nodes'];
                const wsEdges = wb.Sheets['Edges'];
                const wsConfig = wb.Sheets['Config'];

                if (!wsNodes) throw new Error('Excel must have a "Nodes" sheet.');

                const nodesRows = XLSX.utils.sheet_to_json(wsNodes) as any[];
                const edgesRows = wsEdges ? XLSX.utils.sheet_to_json(wsEdges) as any[] : [];
                const configRows = wsConfig ? XLSX.utils.sheet_to_json(wsConfig) as any[] : [];

                const tabDataMap = new Map<string, { nodes: Node<TrafficNodeData>[], edges: Edge[] }>();
                const nodeLookup = new Map<string, Map<string, string>>();

                nodesRows.forEach((row, index) => {
                    const tabName = String(row['Tab Name'] || 'Flow').trim();
                    if (!tabDataMap.has(tabName)) {
                        tabDataMap.set(tabName, { nodes: [], edges: [] });
                        nodeLookup.set(tabName, new Map());
                    }

                    const microservice = String(row.Microservice || '').trim();
                    const api = String(row.API || '').trim();
                    if (!microservice) return;

                    const nodeId = `node-${tabName}-${index}`;
                    const excelId = row.ID || row.Id || row.id;

                    const lookup = nodeLookup.get(tabName)!;
                    if (excelId !== undefined) lookup.set(`id:${excelId}`, nodeId);
                    const nameKey = `name:${microservice}|${api}`;
                    if (!lookup.has(nameKey)) lookup.set(nameKey, nodeId);

                    const node: Node<TrafficNodeData> = {
                        id: nodeId,
                        type: 'custom',
                        position: { x: 0, y: 0 },
                        data: {
                            label: microservice,
                            microservice,
                            api,
                            owner: String(row.Owner || ''),
                            dailyQPS: Number(row['Baseline QPS'] || row['Daily QPS'] || row['QPS']) || 0,
                            maxQPS: Number(row['Max QPS']) || 1000,
                            rateLimitQPS: Number(row['Rate Limit QPS']) || 500
                        }
                    };
                    tabDataMap.get(tabName)!.nodes.push(node);
                });

                // 1. Initial Layout Pass for all tabs to determine node positions
                tabDataMap.forEach((flow, _name) => {
                    flow.nodes = autoLayoutNodes(flow.nodes, []); // Layout without edges first to get positions
                });

                // 2. Parse Edges with smart handle calculation
                edgesRows.forEach(row => {
                    const tabName = String(row['Tab Name'] || 'Flow').trim();
                    const lookup = nodeLookup.get(tabName);
                    if (!lookup) return;

                    let sourceId = '';
                    let targetId = '';

                    const eFromId = row['From ID'] || row.FromId;
                    const eToId = row['To ID'] || row.ToId;

                    if (eFromId !== undefined && eToId !== undefined) {
                        sourceId = lookup.get(`id:${eFromId}`) || '';
                        targetId = lookup.get(`id:${eToId}`) || '';
                    }

                    if (!sourceId || !targetId) {
                        const fromSvc = String(row['From Microservice'] || '').trim();
                        const fromApi = String(row['From API'] || '').trim();
                        const toSvc = String(row['To Microservice'] || '').trim();
                        const toApi = String(row['To API'] || '').trim();

                        sourceId = sourceId || lookup.get(`name:${fromSvc}|${fromApi}`) || '';
                        targetId = targetId || lookup.get(`name:${toSvc}|${toApi}`) || '';
                    }

                    if (sourceId && targetId) {
                        const multiplier = Number(row['Call Multiplier']) || 1;

                        const tabFlow = tabDataMap.get(tabName)!;
                        const sourceNode = tabFlow.nodes.find(n => n.id === sourceId);
                        const targetNode = tabFlow.nodes.find(n => n.id === targetId);

                        let sourceHandle = 's-right';
                        let targetHandle = 't-left';

                        if (sourceNode && targetNode) {
                            const dx = targetNode.position.x - sourceNode.position.x;
                            const dy = targetNode.position.y - sourceNode.position.y;

                            if (Math.abs(dx) > Math.abs(dy)) {
                                sourceHandle = dx > 0 ? 's-right' : 's-left';
                                targetHandle = dx > 0 ? 't-left' : 't-right';
                            } else {
                                sourceHandle = dy > 0 ? 's-bottom' : 's-top';
                                targetHandle = dy > 0 ? 't-top' : 't-bottom';
                            }
                        }

                        tabFlow.edges.push({
                            id: `e-${sourceId}-${targetId}-${Math.random().toString(36).substr(2, 5)}`,
                            source: sourceId,
                            target: targetId,
                            sourceHandle,
                            targetHandle,
                            animated: true,
                            markerEnd: { type: MarkerType.ArrowClosed },
                            label: multiplier > 1 ? `x${multiplier}` : '',
                            data: { multiplier }
                        });
                    }
                });

                let importedMultiplier = 1;
                if (configRows.length > 0) {
                    const m = configRows[0]['Global Multiplier'] || configRows[0]['Multiplier'];
                    if (m !== undefined) importedMultiplier = Number(m);
                }

                const newTabs: TrafficFlow[] = [];
                let tabCounter = 0;
                tabDataMap.forEach((flow, name) => {
                    // Final layout factoring in edges (if the layout logic needs it)
                    // and then evaluation
                    const finalNodes = autoLayoutNodes(flow.nodes, flow.edges);
                    const evaluatedNodes = runEvaluation(finalNodes, flow.edges, importedMultiplier);

                    newTabs.push({
                        id: `tab-${Date.now()}-${tabCounter++}`,
                        name: name,
                        nodes: evaluatedNodes,
                        edges: flow.edges
                    });
                });

                resolve({ tabs: newTabs, multiplier: importedMultiplier });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('File reading failed'));
        reader.readAsArrayBuffer(file);
    });
};
