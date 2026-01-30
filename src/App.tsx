import React, { useState, useCallback, useEffect } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, addEdge, MarkerType } from '@xyflow/react';
import type { Connection, Edge, Node, NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CustomNode } from './components/CustomNode';
import { evaluateTraffic } from './logic/evaluator';
import type { TrafficNodeData } from './logic/types';
import { TrafficContext } from './logic/context';
import './App.css';
import { Activity, Plus, Download, Upload, X, FileSpreadsheet, FileUp } from 'lucide-react';
import * as XLSX from 'xlsx';

// Define NodeTypes to satisfy strict typing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: NodeTypes = { custom: CustomNode as any };

/**
 * Basic auto-layout based on levels (BFS)
 */
const autoLayoutNodes = (nodes: Node<TrafficNodeData>[], edges: Edge[]): Node<TrafficNodeData>[] => {
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
      position: { x: l * 300, y: c * 150 }
    };
  });
};

interface TrafficFlow {
  id: string;
  name: string;
  nodes: Node<TrafficNodeData>[];
  edges: Edge[];
}

export default function App() {
  const [activeTabId, setActiveTabId] = useState<string>('1');
  const [tabs, setTabs] = useState<TrafficFlow[]>([
    { id: '1', name: 'Main Flow', nodes: [], edges: [] }
  ]);

  // We use the hooks for the *active* flow to get ReactFlow performance benefits
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TrafficNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [multiplier, setMultiplier] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');

  // Sync active flow data to tabs state when nodes/edges change
  // We use a ref or effect?
  // Actually, better to sync only when switching tabs or saving.
  // BUT if we want to export all, we need them customized.
  // Let's stick to: Master state is `tabs`. Component state `nodes/edges` is for the *View*.
  // When switching: Save `nodes/edges` to `tabs`. Load new `nodes/edges`.

  const saveCurrentTab = useCallback(() => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        return { ...t, nodes, edges };
      }
      return t;
    }));
  }, [activeTabId, nodes, edges]);

  // Recalculate Traffic
  const runEvaluation = useCallback((currentNodes: Node<TrafficNodeData>[], currentEdges: Edge[], mult: number): Node<TrafficNodeData>[] => {
    const results = evaluateTraffic(currentNodes, currentEdges, mult);
    const inDegreeMap = new Map<string, number>();
    currentNodes.forEach(n => inDegreeMap.set(n.id, 0));
    currentEdges.forEach(e => inDegreeMap.set(e.target, (inDegreeMap.get(e.target) || 0) + 1));

    return currentNodes.map(node => {
      const res = results.get(node.id);
      const isEntry = (inDegreeMap.get(node.id) || 0) === 0;
      if (res) {
        return {
          ...node,
          data: {
            ...node.data,
            currentQPS: res.currentQPS,
            isEntry,
            status: res.isBottleneck ? (res.bottleneckType === 'max_capacity' ? 'critical' : 'warning') : 'normal',
            bottleneckType: res.bottleneckType
          }
        };
      }
      return {
        ...node,
        data: {
          ...node.data,
          currentQPS: 0,
          isEntry,
          status: 'normal',
          bottleneckType: 'none'
        }
      };
    });
  }, []);

  // Update when Edges or Multiplier change
  useEffect(() => {
    setNodes(nds => runEvaluation(nds, edges, multiplier));
  }, [edges, multiplier, runEvaluation, setNodes]);

  const onConnect = useCallback((params: Connection) => {
    const newEdge = { ...params, animated: true, markerEnd: { type: MarkerType.ArrowClosed } };
    setEdges((eds) => addEdge(newEdge, eds));
  }, [setEdges]);

  // Handle Node Edit
  const updateNodeData = (id: string, newData: Partial<TrafficNodeData>) => {
    setNodes(nds => {
      const updated = nds.map((n): Node<TrafficNodeData> => {
        if (n.id === id) {
          return { ...n, data: { ...n.data, ...newData } };
        }
        return n;
      });
      return runEvaluation(updated, edges, multiplier);
    });
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const addNewNode = () => {
    const id = Date.now().toString();
    const newNode: Node<TrafficNodeData> = {
      id,
      type: 'custom',
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: {
        label: 'New Service',
        microservice: 'service-name',
        api: '/api/endpoint',
        owner: 'team@example.com',
        dailyQPS: 100,
        maxQPS: 1000,
        rateLimitQPS: 500
      }
    };
    setNodes(nds => runEvaluation([...nds, newNode], edges, multiplier));
    setSelectedNodeId(id);
  };

  const deleteNode = (id: string) => {
    setNodes(nds => nds.filter(n => n.id !== id));
    setSelectedNodeId(null);
  };

  // -- Tab Management --

  const handleSwitchTab = (newId: string) => {
    if (newId === activeTabId) return;

    // 1. Update current tab in local 'tabs' array
    const updatedTabs = tabs.map(t =>
      t.id === activeTabId ? { ...t, nodes, edges } : t
    );
    setTabs(updatedTabs);

    // 2. Load new tab
    const target = updatedTabs.find(t => t.id === newId);
    if (target) {
      setActiveTabId(newId);
      setNodes(target.nodes);
      setEdges(target.edges);
      setSelectedNodeId(null);
    }
  };

  const handleAddTab = () => {
    // Save current first
    const updatedTabs = tabs.map(t =>
      t.id === activeTabId ? { ...t, nodes, edges } : t
    );

    const newId = Date.now().toString();
    const newTab: TrafficFlow = {
      id: newId,
      name: `Flow ${updatedTabs.length + 1}`,
      nodes: [],
      edges: []
    };

    setTabs([...updatedTabs, newTab]);
    setActiveTabId(newId);
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
  };

  const handleCloseTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (tabs.length === 1) return; // Don't close last tab

    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);

    if (id === activeTabId) {
      // Switch to the last one or first one
      const nextTab = newTabs[newTabs.length - 1];
      setActiveTabId(nextTab.id);
      setNodes(nextTab.nodes);
      setEdges(nextTab.edges);
    }
  };

  const handleRenameTab = (id: string, newName: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, name: newName } : t));
  };


  const handleExport = () => {
    // Save current state to tabs first to ensure it's up to date
    const currentTab = { id: activeTabId, name: tabs.find(t => t.id === activeTabId)?.name || 'Flow', nodes, edges };
    // We can export just the current tab or all. Let's export current for now to match behavior.
    const data = { ...currentTab, multiplier };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `traffic-flow-${currentTab.name}.json`;
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const json = JSON.parse(event.target?.result as string) as any;
          if (json.nodes && json.edges) {
            // Import as NEW Tab
            const newId = Date.now().toString();
            const newTab: TrafficFlow = {
              id: newId,
              name: json.name || file.name.replace('.json', ''),
              nodes: json.nodes,
              edges: json.edges
            };
            // Save current work before switch
            setTabs(prev => {
              const saved = prev.map(t => t.id === activeTabId ? { ...t, nodes, edges } : t);
              return [...saved, newTab];
            });
            setActiveTabId(newId);
            setNodes(newTab.nodes);
            setEdges(newTab.edges);
            if (json.multiplier) setMultiplier(json.multiplier);
          }
        } catch (err) {
          console.error(err);
          alert('Invalid JSON');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleExportExcel = () => {
    // Sync current tab state before export
    const syncedTabs = tabs.map(t => t.id === activeTabId ? { ...t, nodes, edges } : t);

    const nodesRows: any[] = [];
    const edgesRows: any[] = [];

    syncedTabs.forEach(tab => {
      const idMap = new Map<string, number>();

      tab.nodes.forEach((n, idx) => {
        const simpleId = idx + 1;
        idMap.set(n.id, simpleId);
        nodesRows.push({
          'Tab Name': tab.name,
          'ID': simpleId,
          'Microservice': n.data.microservice,
          'API': n.data.api,
          'Owner': n.data.owner,
          'Daily QPS': n.data.dailyQPS,
          'Max QPS': n.data.maxQPS,
          'Rate Limit QPS': n.data.rateLimitQPS
        });
      });

      tab.edges.forEach(e => {
        const sourceNode = tab.nodes.find(sn => sn.id === e.source);
        const targetNode = tab.nodes.find(tn => tn.id === e.target);
        const fromSimpleId = idMap.get(e.source);
        const toSimpleId = idMap.get(e.target);

        if (sourceNode && targetNode && fromSimpleId && toSimpleId) {
          edgesRows.push({
            'Tab Name': tab.name,
            'From ID': fromSimpleId,
            'To ID': toSimpleId,
            'From Microservice': sourceNode.data.microservice,
            'To Microservice': targetNode.data.microservice
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

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error('Data read error');

        const wb = XLSX.read(data, { type: 'array' });

        const wsNodes = wb.Sheets['Nodes'];
        const wsEdges = wb.Sheets['Edges'];
        const wsConfig = wb.Sheets['Config'];

        if (!wsNodes) {
          alert('Excel must have a "Nodes" sheet.');
          return;
        }

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
          // Store by Excel ID if present
          if (excelId !== undefined) {
            lookup.set(`id:${excelId}`, nodeId);
          }
          // Also store by name as fallback
          const nameKey = `name:${microservice}|${api}`;
          if (!lookup.has(nameKey)) {
            lookup.set(nameKey, nodeId);
          }

          const node: Node<TrafficNodeData> = {
            id: nodeId,
            type: 'custom',
            position: { x: 0, y: 0 },
            data: {
              label: microservice,
              microservice,
              api,
              owner: String(row.Owner || ''),
              dailyQPS: Number(row['Daily QPS']) || 0,
              maxQPS: Number(row['Max QPS']) || 1000,
              rateLimitQPS: Number(row['Rate Limit QPS']) || 500
            }
          };
          tabDataMap.get(tabName)!.nodes.push(node);
        });

        edgesRows.forEach(row => {
          const tabName = String(row['Tab Name'] || 'Flow').trim();
          const lookup = nodeLookup.get(tabName);
          if (!lookup) return;

          let sourceId = '';
          let targetId = '';

          // 1. Try linking via ID if both From ID and To ID exist
          const eFromId = row['From ID'] || row.FromId;
          const eToId = row['To ID'] || row.ToId;

          if (eFromId !== undefined && eToId !== undefined) {
            sourceId = lookup.get(`id:${eFromId}`) || '';
            targetId = lookup.get(`id:${eToId}`) || '';
          }

          // 2. Fallback to name-based if IDs didn't match or weren't provided
          if (!sourceId || !targetId) {
            const fromSvc = String(row['From Microservice'] || '').trim();
            const fromApi = String(row['From API'] || '').trim();
            const toSvc = String(row['To Microservice'] || '').trim();
            const toApi = String(row['To API'] || '').trim();

            sourceId = sourceId || lookup.get(`name:${fromSvc}|${fromApi}`) || '';
            targetId = targetId || lookup.get(`name:${toSvc}|${toApi}`) || '';
          }

          if (sourceId && targetId) {
            tabDataMap.get(tabName)!.edges.push({
              id: `e-${sourceId}-${targetId}-${Math.random().toString(36).substr(2, 5)}`,
              source: sourceId,
              target: targetId,
              animated: true,
              markerEnd: { type: MarkerType.ArrowClosed }
            });
          }
        });

        let importedMultiplier = 1;
        if (configRows.length > 0) {
          const m = configRows[0]['Global Multiplier'] || configRows[0]['Multiplier'];
          if (m !== undefined) importedMultiplier = Number(m);
        }
        setMultiplier(importedMultiplier);

        const newTabs: TrafficFlow[] = [];
        let tabCounter = 0;
        tabDataMap.forEach((flow, name) => {
          const layoutedNodes = autoLayoutNodes(flow.nodes, flow.edges);
          const evaluatedNodes = runEvaluation(layoutedNodes, flow.edges, importedMultiplier);

          newTabs.push({
            id: `tab-${Date.now()}-${tabCounter++}`,
            name: name,
            nodes: evaluatedNodes,
            edges: flow.edges
          });
        });

        if (newTabs.length > 0) {
          setTabs(newTabs);
          setActiveTabId(newTabs[0].id);
          setNodes(newTabs[0].nodes);
          setEdges(newTabs[0].edges);
        } else {
          alert('Excel 中没有找到有效的节点数据。');
        }
      } catch (err) {
        console.error(err);
        alert('导入 Excel 失败: ' + (err instanceof Error ? err.message : '未知错误'));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="traffic-app">
      <header className="app-header">
        <div className="app-title">
          <Activity className="text-accent" size={24} color="#3b82f6" />
          <span>Traffic Evaluator</span>
        </div>
        <div className="controls">
          <div className="control-group">
            <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Traffic Multiplier:</span>
            <input
              type="number"
              step="0.1"
              min="0"
              value={multiplier}
              onChange={(e) => setMultiplier(parseFloat(e.target.value) || 0)}
              className="multiplier-input"
            />
            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>x</span>
          </div>

          <div className="control-group" style={{ background: 'transparent', border: 'none', padding: 0 }}>
            <button className="btn btn-secondary" onClick={handleExport} title="Export JSON">
              <Download size={18} />
            </button>
            <label className="btn btn-secondary" title="Import JSON" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Upload size={18} />
              <input type="file" style={{ display: 'none' }} accept=".json" onChange={handleImport} />
            </label>
            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
            <button className="btn btn-secondary" onClick={handleExportExcel} title="Export Excel">
              <FileSpreadsheet size={18} />
            </button>
            <label className="btn btn-secondary" title="Import Excel" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <FileUp size={18} />
              <input type="file" style={{ display: 'none' }} accept=".xlsx, .xls" onChange={handleImportExcel} />
            </label>
          </div>

          <button className="btn" onClick={addNewNode} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={18} /> Add Node
          </button>
        </div>
      </header>

      {/* Tabs Bar */}
      <div className="tabs-header">
        {tabs.map(tab => {
          const isEditing = editingTabId === tab.id;
          return (
            <div
              key={tab.id}
              className={`tab ${activeTabId === tab.id ? 'active' : ''}`}
              onClick={() => !isEditing && handleSwitchTab(tab.id)}
            >
              {isEditing ? (
                <input
                  className="tab-name-input nodrag"
                  value={editingTabName}
                  onChange={(e) => setEditingTabName(e.target.value)}
                  onBlur={() => {
                    handleRenameTab(tab.id, editingTabName);
                    setEditingTabId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameTab(tab.id, editingTabName);
                      setEditingTabId(null);
                    } else if (e.key === 'Escape') {
                      setEditingTabId(null);
                    }
                  }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingTabId(tab.id);
                    setEditingTabName(tab.name);
                  }}
                >
                  {tab.name}
                </span>
              )}
              <div
                className="tab-close"
                onClick={(e) => handleCloseTab(e, tab.id)}
                title="Close Tab"
              >
                <X size={14} />
              </div>
            </div>
          );
        })}
        <div className="new-tab-btn" onClick={handleAddTab} title="New Flow">
          <Plus size={16} />
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <TrafficContext.Provider value={{ updateNodeData, deleteNode }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
          >
            <Background color="#1e293b" gap={16} />
            <Controls />
            <MiniMap style={{ background: '#1e293b' }} nodeColor={() => '#3b82f6'} />
          </ReactFlow>
        </TrafficContext.Provider>

        {selectedNode && (
          <div className="edit-panel">
            <h3 className="panel-title">Edit Node</h3>
            <div className="form-group">
              <label>Microservice Name</label>
              <input
                value={selectedNode.data.microservice}
                onChange={e => updateNodeData(selectedNode.id, { microservice: e.target.value })}
                placeholder="service-name"
              />
            </div>

            <div className="form-group">
              <label>API / Interface</label>
              <input
                value={selectedNode.data.api}
                onChange={e => updateNodeData(selectedNode.id, { api: e.target.value })}
                placeholder="/api/endpoint"
              />
            </div>

            <div className="form-group">
              <label>Owner</label>
              <input
                value={selectedNode.data.owner}
                onChange={e => updateNodeData(selectedNode.id, { owner: e.target.value })}
                placeholder="team@example.com"
              />
            </div>

            <div className="form-group">
              <label>Daily QPS (Baseline Traffic)</label>
              <input
                type="number"
                value={selectedNode.data.dailyQPS}
                onChange={e => updateNodeData(selectedNode.id, { dailyQPS: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label>Rate Limit (Warning Threshold)</label>
              <input
                type="number"
                value={selectedNode.data.rateLimitQPS}
                onChange={e => updateNodeData(selectedNode.id, { rateLimitQPS: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label>Max Capacity (Failure Point)</label>
              <input
                type="number"
                value={selectedNode.data.maxQPS}
                onChange={e => updateNodeData(selectedNode.id, { maxQPS: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => deleteNode(selectedNode.id)}>Delete Node</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
