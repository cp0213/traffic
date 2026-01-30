import React, { useState, useCallback, useEffect } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, addEdge, MarkerType, reconnectEdge } from '@xyflow/react';
import type { Connection, Edge, Node, NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { CustomNode } from './components/CustomNode';
import { TabBar } from './components/TabBar';
import { EditPanel } from './components/EditPanel';

import { evaluateTraffic } from './logic/evaluator';
import type { TrafficNodeData } from './logic/types';
import { TrafficContext } from './logic/context';
import { autoLayoutNodes } from './logic/layout';
import { exportToExcel, parseExcelFile, type TrafficFlow } from './logic/excel';
import { exportToJSON, parseJSONFile } from './logic/json';

import './App.css';
import { Activity, Plus, Download, Upload, FileSpreadsheet, FileUp } from 'lucide-react';

// Define NodeTypes to satisfy strict typing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: NodeTypes = { custom: CustomNode as any };

export default function App() {
  const [activeTabId, setActiveTabId] = useState<string>('1');
  const [tabs, setTabs] = useState<TrafficFlow[]>([
    { id: '1', name: 'Main Flow', nodes: [], edges: [] }
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TrafficNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [multiplier, setMultiplier] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');

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

  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    setEdges((els) => reconnectEdge(oldEdge, newConnection, els));
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
    const updatedTabs = tabs.map(t => t.id === activeTabId ? { ...t, nodes, edges } : t);
    setTabs(updatedTabs);

    const target = updatedTabs.find(t => t.id === newId);
    if (target) {
      setActiveTabId(newId);
      setNodes(target.nodes);
      setEdges(target.edges);
      setSelectedNodeId(null);
    }
  };

  const handleAddTab = () => {
    const updatedTabs = tabs.map(t => t.id === activeTabId ? { ...t, nodes, edges } : t);
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
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (id === activeTabId) {
      const nextTab = newTabs[newTabs.length - 1];
      setActiveTabId(nextTab.id);
      setNodes(nextTab.nodes);
      setEdges(nextTab.edges);
    }
  };

  const handleRenameTab = (id: string, newName: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, name: newName } : t));
  };

  // -- IO Handlers --

  const handleExportJSON = () => {
    exportToJSON(activeTabId, tabs, nodes, edges, multiplier);
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const json = await parseJSONFile(file);
      if (json.nodes && json.edges) {
        const newId = Date.now().toString();
        const newTab: TrafficFlow = {
          id: newId,
          name: json.name || file.name.replace('.json', ''),
          nodes: json.nodes,
          edges: json.edges
        };
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
      alert('Invalid JSON');
    }
  };

  const handleExportExcel = () => {
    exportToExcel(tabs, activeTabId, nodes, edges, multiplier);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await parseExcelFile(file, runEvaluation);
      setMultiplier(result.multiplier);
      if (result.tabs.length > 0) {
        setTabs(result.tabs);
        setActiveTabId(result.tabs[0].id);
        setNodes(result.tabs[0].nodes);
        setEdges(result.tabs[0].edges);
      }
    } catch (err) {
      alert('Import failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
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
            <button className="btn btn-secondary" onClick={handleExportJSON} title="Export JSON">
              <Download size={18} />
            </button>
            <label className="btn btn-secondary" title="Import JSON" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Upload size={18} />
              <input type="file" style={{ display: 'none' }} accept=".json" onChange={handleImportJSON} />
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

      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        editingTabId={editingTabId}
        editingTabName={editingTabName}
        onSwitchTab={handleSwitchTab}
        onAddTab={handleAddTab}
        onCloseTab={handleCloseTab}
        onRenameTab={handleRenameTab}
        setEditingTabId={setEditingTabId}
        setEditingTabName={setEditingTabName}
      />

      <div style={{ flex: 1, position: 'relative' }}>
        <TrafficContext.Provider value={{ updateNodeData, deleteNode }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
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
          <EditPanel
            selectedNode={selectedNode}
            updateNodeData={updateNodeData}
            deleteNode={deleteNode}
          />
        )}
      </div>
    </div>
  );
}
