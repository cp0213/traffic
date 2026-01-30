import { createContext, useContext } from 'react';
import type { TrafficNodeData } from './types';

interface TrafficContextType {
    updateNodeData: (id: string, data: Partial<TrafficNodeData>) => void;
    deleteNode: (id: string) => void;
}

export const TrafficContext = createContext<TrafficContextType | undefined>(undefined);

export function useTraffic() {
    const context = useContext(TrafficContext);
    if (!context) {
        throw new Error('useTraffic must be used within a TrafficProvider');
    }
    return context;
}
