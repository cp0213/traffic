import React from 'react';
import type { Node } from '@xyflow/react';
import type { TrafficNodeData } from '../logic/types';

interface EditPanelProps {
    selectedNode: Node<TrafficNodeData>;
    updateNodeData: (id: string, newData: Partial<TrafficNodeData>) => void;
    deleteNode: (id: string) => void;
}

export const EditPanel: React.FC<EditPanelProps> = ({ selectedNode, updateNodeData, deleteNode }) => {
    return (
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
    );
};
