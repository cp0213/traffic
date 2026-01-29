import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { TrafficNodeData } from '../logic/types';

export function CustomNode({ data, selected }: NodeProps<Node<TrafficNodeData>>) {
    let statusColor = '#22c55e'; // green
    if (data.bottleneckType === 'max_capacity') statusColor = '#ef4444'; // red
    else if (data.bottleneckType === 'rate_limit') statusColor = '#f59e0b'; // orange

    const current = data.currentQPS !== undefined ? data.currentQPS : data.dailyQPS; // Default to daily if no eval yet
    // If we have an evaluated currentQPS, use it.

    // Calculate percentage
    const percent = Math.min((current / data.maxQPS) * 100, 100);

    return (
        <div className={`custom-node ${selected ? 'selected' : ''}`} style={{ borderColor: statusColor }}>
            <Handle type="target" position={Position.Top} />

            <div className="node-header">
                <div className="node-title">{data.label}</div>
                {data.isEntry && <div className="badge entry">ENTRY</div>}
            </div>

            <div className="node-metrics">
                <div className="metric-row main-metric">
                    <span className="label">Load</span>
                    <span className="value" style={{ color: statusColor }}>
                        {current.toFixed(0)} <span className="unit">/ {data.maxQPS}</span>
                    </span>
                </div>

                <div className="progress-track">
                    <div
                        className="progress-fill"
                        style={{ width: `${percent}%`, backgroundColor: statusColor }}
                    />
                </div>

                <div className="metric-row sub-metric">
                    <span>Limit: {data.rateLimitQPS}</span>
                    <span>Daily: {data.dailyQPS}</span>
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} />
        </div>
    );
}
