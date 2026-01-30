import { useState, useEffect } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { TrafficNodeData } from '../logic/types';
import { useTraffic } from '../logic/context';
import { Pencil, Check } from 'lucide-react';

export function CustomNode({ id, data, selected }: NodeProps<Node<TrafficNodeData>>) {
    const { updateNodeData } = useTraffic();
    const [isEditing, setIsEditing] = useState(false);

    // Local state for editing to avoid input lag
    const [editValues, setEditValues] = useState({
        microservice: data.microservice,
        api: data.api,
        maxQPS: data.maxQPS,
        rateLimitQPS: data.rateLimitQPS,
        dailyQPS: data.dailyQPS
    });

    // Sync local state when data changes from outside
    useEffect(() => {
        if (!isEditing) {
            setEditValues({
                microservice: data.microservice,
                api: data.api,
                maxQPS: data.maxQPS,
                rateLimitQPS: data.rateLimitQPS,
                dailyQPS: data.dailyQPS
            });
        }
    }, [data, isEditing]);

    const handleDoneEditing = () => {
        // Commit all changes at once
        updateNodeData(id, {
            microservice: editValues.microservice,
            api: editValues.api,
            maxQPS: editValues.maxQPS,
            rateLimitQPS: editValues.rateLimitQPS,
            dailyQPS: editValues.dailyQPS
        });
        setIsEditing(false);
    };

    let statusColor = '#22c55e'; // green
    if (data.bottleneckType === 'max_capacity') statusColor = '#ef4444'; // red
    else if (data.bottleneckType === 'rate_limit') statusColor = '#f59e0b'; // orange

    const current = data.currentQPS !== undefined ? data.currentQPS : data.dailyQPS;
    const percent = Math.min((current / data.maxQPS) * 100, 100);

    return (
        <div className={`custom-node ${selected ? 'selected' : ''}`} style={{ borderColor: statusColor }}>
            <Handle type="target" position={Position.Top} id="t-top" className="custom-handle" />
            <Handle type="target" position={Position.Left} id="t-left" className="custom-handle" />

            <div className="node-header">
                {isEditing ? (
                    <>
                        <div style={{ flex: 1 }}>
                            <input
                                className="node-title-input nodrag"
                                value={editValues.microservice}
                                onChange={(e) => setEditValues(prev => ({ ...prev, microservice: e.target.value }))}
                                placeholder="Microservice Name"
                                autoFocus
                            />
                            <input
                                className="node-subtitle-input nodrag"
                                value={editValues.api}
                                onChange={(e) => setEditValues(prev => ({ ...prev, api: e.target.value }))}
                                placeholder="API Endpoint"
                            />
                        </div>
                    </>
                ) : (
                    <div style={{ flex: 1 }}>
                        <div className="node-title">{data.microservice}</div>
                        {data.api && <div className="node-subtitle">{data.api}</div>}
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isEditing ? (
                        <button className="icon-btn success" onClick={handleDoneEditing} title="Done">
                            <Check size={14} />
                        </button>
                    ) : (
                        <>
                            {data.isEntry && <span className="badge entry">ENTRY</span>}
                            <button className="icon-btn" onClick={() => setIsEditing(true)} title="Edit">
                                <Pencil size={12} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="node-metrics">
                <div className="metric-row main-metric">
                    <span className="label">Load</span>
                    <span className="value" style={{ color: statusColor }}>
                        {current.toFixed(0)} <span className="unit">/</span>
                        {isEditing ? (
                            <input
                                type="number"
                                className="metric-input nodrag"
                                style={{ width: 50, color: statusColor }}
                                value={editValues.maxQPS}
                                onChange={(e) => setEditValues(prev => ({ ...prev, maxQPS: parseInt(e.target.value) || 0 }))}
                            />
                        ) : (
                            <span style={{ marginLeft: 4 }}>{data.maxQPS}</span>
                        )}
                    </span>
                </div>

                <div className="progress-track">
                    <div
                        className="progress-fill"
                        style={{ width: `${percent}%`, backgroundColor: statusColor }}
                    />
                </div>

                <div className="metric-row sub-metric">
                    <div className="metric-item">
                        <span>Limit:</span>
                        {isEditing ? (
                            <input
                                type="number"
                                className="metric-input nodrag"
                                value={editValues.rateLimitQPS}
                                onChange={(e) => setEditValues(prev => ({ ...prev, rateLimitQPS: parseInt(e.target.value) || 0 }))}
                            />
                        ) : (
                            <span style={{ marginLeft: 4 }}>{data.rateLimitQPS}</span>
                        )}
                    </div>
                    <div className="metric-item">
                        <span>Daily:</span>
                        {isEditing ? (
                            <input
                                type="number"
                                className="metric-input nodrag"
                                value={editValues.dailyQPS}
                                onChange={(e) => setEditValues(prev => ({ ...prev, dailyQPS: parseInt(e.target.value) || 0 }))}
                            />
                        ) : (
                            <span style={{ marginLeft: 4 }}>{data.dailyQPS}</span>
                        )}
                    </div>
                </div>
            </div>

            <Handle type="source" position={Position.Right} id="s-right" className="custom-handle" />
            <Handle type="source" position={Position.Bottom} id="s-bottom" className="custom-handle" />
        </div>
    );
}
