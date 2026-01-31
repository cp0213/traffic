export interface TrafficNodeData extends Record<string, unknown> {
    label: string;
    microservice: string;
    api: string;
    owner: string;
    dailyQPS: number;
    maxQPS: number;
    rateLimitQPS: number;

    // Dynamic fields for visualization
    currentQPS?: number;
    isEntry?: boolean; // Now a dynamic field for visualization
    status?: 'normal' | 'warning' | 'critical';
    bottleneckType?: 'none' | 'rate_limit' | 'max_capacity';
}

export interface TrafficEdgeData extends Record<string, unknown> {
    multiplier: number;
}

export interface EvaluationResult {
    nodeId: string;
    currentQPS: number;
    isBottleneck: boolean;
    bottleneckType: 'none' | 'rate_limit' | 'max_capacity';
}
