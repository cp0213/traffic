export interface TrafficNodeData extends Record<string, unknown> {
    label: string;
    microservice: string;
    api: string;
    owner: string;
    dailyQPS: number;
    maxQPS: number;
    rateLimitQPS: number;
    isEntry: boolean;

    // Dynamic fields for visualization
    currentQPS?: number;
    status?: 'normal' | 'warning' | 'critical';
    bottleneckType?: 'none' | 'rate_limit' | 'max_capacity';
}

export interface EvaluationResult {
    nodeId: string;
    currentQPS: number;
    isBottleneck: boolean;
    bottleneckType: 'none' | 'rate_limit' | 'max_capacity';
}
