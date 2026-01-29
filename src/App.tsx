import React, { useState, useCallback, useEffect } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, addEdge } from '@xyflow/react';
import type { Connection, Edge, Node, NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CustomNode } from './components/CustomNode';
import { evaluateTraffic } from './logic/evaluator';
import type { TrafficNodeData } from './logic/types';
import './App.css';
import { Activity, Plus, Download, Upload } from 'lucide-react';

// Define NodeTypes to satisfy strict typing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: NodeTypes = { custom: CustomNode as any };

const initialNodes: Node<TrafficNodeData>[] = [
  { id: '1', type: 'custom', position: { x: 250, y: 50 }, data: { label: 'API Gateway', dailyQPS: 1000, maxQPS: 5000, rateLimitQPS: 3000, isEntry: true } },
  { id: '2', type: 'custom', position: { x: 250, y: 250 }, data: { label: 'Auth Service', dailyQPS: 1000, maxQPS: 2000, rateLimitQPS: 1500, isEntry: false } },
  { id: '3', type: 'custom', position: { x: 100, y: 450 }, data: { label: 'User DB', dailyQPS: 500, maxQPS: 1000, rateLimitQPS: 800, isEntry: false } },
  { id: '4', type: 'custom', position: { x: 400, y: 450 }, data: { label: 'Order Service', dailyQPS: 800, maxQPS: 2000, rateLimitQPS: 1200, isEntry: false } },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e2-3', source: '2', target: '3', animated: true },
  { id: 'e2-4', source: '2', target: '4', animated: true },
];

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [multiplier, setMultiplier] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Recalculate Traffic
  const runEvaluation = useCallback((currentNodes: Node<TrafficNodeData>[], currentEdges: Edge[], mult: number): Node<TrafficNodeData>[] => {
    const results = evaluateTraffic(currentNodes, currentEdges, mult);

    return currentNodes.map(node => {
      const res = results.get(node.id);
      if (res) {
        return {
          ...node,
          data: {
            ...node.data,
            currentQPS: res.currentQPS,
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
          status: 'normal',
          bottleneckType: 'none'
        }
      };
    });
  }, []);

  // Update when Edges or Multiplier change
  useEffect(() => {
    // Only update if data would change.
    setNodes(nds => runEvaluation(nds, edges, multiplier));
  }, [edges, multiplier, runEvaluation, setNodes]);

  // Initial Run
  useEffect(() => {
    setNodes(nds => runEvaluation(nds, edges, multiplier));
  }, []);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, animated: true }, eds));
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
      // Re-run evaluation immediately on data change
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
        dailyQPS: 100,
        maxQPS: 1000,
        rateLimitQPS: 500,
        isEntry: false
      }
    };
    setNodes(nds => runEvaluation([...nds, newNode], edges, multiplier));
    setSelectedNodeId(id);
  };

  const deleteNode = (id: string) => {
    setNodes(nds => nds.filter(n => n.id !== id));
    setSelectedNodeId(null);
  };

  const handleExport = () => {
    const data = { nodes, edges, multiplier };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'traffic-config.json';
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
          if (json.nodes) setNodes(json.nodes);
          if (json.edges) setEdges(json.edges);
          if (json.multiplier) setMultiplier(json.multiplier);
        } catch (err) {
          console.error(err);
          alert('Invalid JSON');
        }
      };
      reader.readAsText(file);
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
            <button className="btn btn-secondary" onClick={handleExport} title="Export Config">
              <Download size={18} />
            </button>
            <label className="btn btn-secondary" title="Import Config" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Upload size={18} />
              <input type="file" style={{ display: 'none' }} accept=".json" onChange={handleImport} />
            </label>
          </div>

          <button className="btn" onClick={addNewNode} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={18} /> Add Node
          </button>
        </div>
      </header>

      <div style={{ flex: 1, position: 'relative' }}>
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

        {selectedNode && (
          <div className="edit-panel">
            <h3 className="panel-title">Edit Node</h3>
            <div className="form-group">
              <label>Service Name</label>
              <input
                value={selectedNode.data.label}
                onChange={e => updateNodeData(selectedNode.id, { label: e.target.value })}
              />
            </div>

            <div className="form-group form-checkbox" style={{ background: 'rgba(59, 130, 246, 0.1)', padding: 10, borderRadius: 6, marginBottom: 15, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <input
                type="checkbox"
                id="isEntry"
                checked={selectedNode.data.isEntry}
                onChange={e => updateNodeData(selectedNode.id, { isEntry: e.target.checked })}
              />
              <label htmlFor="isEntry" style={{ marginBottom: 0, color: '#93c5fd', fontWeight: 500, cursor: 'pointer' }}>Is Entry Node?</label>
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
