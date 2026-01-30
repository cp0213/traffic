import React from 'react';
import { Plus, X } from 'lucide-react';
import type { TrafficFlow } from '../logic/excel';

interface TabBarProps {
    tabs: TrafficFlow[];
    activeTabId: string;
    editingTabId: string | null;
    editingTabName: string;
    onSwitchTab: (id: string) => void;
    onAddTab: () => void;
    onCloseTab: (e: React.MouseEvent, id: string) => void;
    onRenameTab: (id: string, newName: string) => void;
    setEditingTabId: (id: string | null) => void;
    setEditingTabName: (name: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
    tabs,
    activeTabId,
    editingTabId,
    editingTabName,
    onSwitchTab,
    onAddTab,
    onCloseTab,
    onRenameTab,
    setEditingTabId,
    setEditingTabName
}) => {
    return (
        <div className="tabs-header">
            {tabs.map(tab => {
                const isEditing = editingTabId === tab.id;
                return (
                    <div
                        key={tab.id}
                        className={`tab ${activeTabId === tab.id ? 'active' : ''}`}
                        onClick={() => !isEditing && onSwitchTab(tab.id)}
                    >
                        {isEditing ? (
                            <input
                                className="tab-name-input nodrag"
                                value={editingTabName}
                                onChange={(e) => setEditingTabName(e.target.value)}
                                onBlur={() => {
                                    onRenameTab(tab.id, editingTabName);
                                    setEditingTabId(null);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        onRenameTab(tab.id, editingTabName);
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
                            onClick={(e) => onCloseTab(e, tab.id)}
                            title="Close Tab"
                        >
                            <X size={14} />
                        </div>
                    </div>
                );
            })}
            <div className="new-tab-btn" onClick={onAddTab} title="New Flow">
                <Plus size={16} />
            </div>
        </div>
    );
};
