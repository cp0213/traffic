import React from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { TrafficNodeData } from '../logic/types';

interface EditPanelProps {
    type: 'node' | 'edge';
    selectedItem: Node<TrafficNodeData> | Edge;
    updateNodeData?: (id: string, newData: Partial<TrafficNodeData>) => void;
    deleteNode?: (id: string) => void;
    deleteEdge?: (id: string) => void;
}

export const EditPanel: React.FC<EditPanelProps> = ({
    type,
    selectedItem,
    updateNodeData,
    deleteNode,
    deleteEdge
}) => {
    if (type === 'edge') {
        const edge = selectedItem as Edge;
        return (
            <div className="edit-panel">
                <h3 className="panel-title">Edit Connection</h3>
                <div className="form-group">
                    <label>From: {edge.source}</label>
                </div>
                <div className="form-group">
                    <label>To: {edge.target}</label>
                </div>
                <div style={{ marginTop: 20 }}>
                    <button
                        className="btn btn-danger"
                        style={{ width: '100%' }}
                        onClick={() => deleteEdge?.(edge.id)}
                    >
                        Delete Connection
                    </button>
                </div>
            </div>
        );
    }

    const node = selectedItem as Node<TrafficNodeData>;
    return (
        <div className="edit-panel">
            <h3 className="panel-title">Edit Node</h3>
            <div className="form-group">
                <label>Microservice Name</label>
                <input
                    value={node.data.microservice}
                    onChange={e => updateNodeData?.(node.id, { microservice: e.target.value })}
                    placeholder="service-name"
                />
            </div>

            <div className="form-group">
                <label>API / Interface</label>
                <input
                    value={node.data.api}
                    onChange={e => updateNodeData?.(node.id, { api: e.target.value })}
                    placeholder="/api/endpoint"
                />
            </div>

            <div className="form-group">
                <label>Owner</label>
                <input
                    value={node.data.owner}
                    onChange={e => updateNodeData?.(node.id, { owner: e.target.value })}
                    placeholder="team@example.com"
                />
            </div>

            <div className="form-group">
                <label>Daily QPS (Baseline Traffic)</label>
                <input
                    type="number"
                    value={node.data.dailyQPS}
                    onChange={e => updateNodeData?.(node.id, { dailyQPS: parseInt(e.target.value) || 0 })}
                />
            </div>
            <div className="form-group">
                <label>Rate Limit (Warning Threshold)</label>
                <input
                    type="number"
                    value={node.data.rateLimitQPS}
                    onChange={e => updateNodeData?.(node.id, { rateLimitQPS: parseInt(e.target.value) || 0 })}
                />
            </div>
            <div className="form-group">
                <label>Max Capacity (Failure Point)</label>
                <input
                    type="number"
                    value={node.data.maxQPS}
                    onChange={e => updateNodeData?.(node.id, { maxQPS: parseInt(e.target.value) || 0 })}
                />
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                <button
                    className="btn btn-danger"
                    style={{ width: '100%' }}
                    onClick={() => deleteNode?.(node.id)}
                >
                    Delete Node
                </button>
            </div>
        </div>
    );
};
