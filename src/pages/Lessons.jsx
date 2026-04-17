import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { lessonPlanService } from '../services/lessonPlanService';
import { 
    BookOpen, Plus, Edit2, Trash2, ChevronRight, ChevronDown, 
    MoreVertical, FolderPlus, FilePlus, Sparkles, BookCheck, 
    Layers, Search, GripVertical, AlertCircle, X, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

export default function Lessons() {
    const { userProfile } = useAuth();
    const [rawItems, setRawItems] = useState([]);
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedIds, setExpandedIds] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 5; // Subjects per page

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [form, setForm] = useState({ title: '', parentId: null, level: 0, batchId: '' });

    useEffect(() => {
        if (userProfile?.id) loadData();
    }, [userProfile]);

    async function loadData() {
        try {
            setLoading(true);
            const uid = userProfile.id;
            
            // Parallel fetch
            const [data, batchList] = await Promise.all([
                lessonPlanService.getFullHierarchy(uid),
                supabase.from('batches').select('*').eq('teacher_id', uid).eq('status', 'active')
            ]);

            setRawItems(data || []);
            setBatches(batchList.data || []);
            
            // Select first batch if none selected
            if (!selectedBatchId && batchList.data?.length > 0) {
                setSelectedBatchId(batchList.data[0].id);
            }

            // Auto-expand top levels
            const topLevelIds = (data || []).filter(i => !i.parent_id).map(i => i.id);
            setExpandedIds(new Set(topLevelIds));
        } catch (err) {
            console.error(err);
            toast.error('Failed to load lesson plans');
        } finally {
            setLoading(false);
        }
    }

    // Tree Construction & Filtering
    const treeData = useMemo(() => {
        const buildTree = (parentId = null) => {
            return rawItems
                .filter(item => {
                    const isChildOfParent = item.parent_id === parentId;
                    const matchesBatch = parentId || (item.batch_id === selectedBatchId);
                    return isChildOfParent && matchesBatch;
                })
                .sort((a, b) => a.order_index - b.order_index)
                .map(item => ({
                    ...item,
                    children: buildTree(item.id)
                }));
        };
        const fullTree = buildTree(null);

        // Smart Search: Preserve parent if child matches
        if (!searchQuery) return fullTree;
        
        const filterTree = (nodes) => {
            return nodes.filter(node => {
                const matches = node.title.toLowerCase().includes(searchQuery.toLowerCase());
                const filteredChildren = filterTree(node.children);
                if (matches || filteredChildren.length > 0) {
                    node.children = filteredChildren;
                    return true;
                }
                return false;
            });
        };
        return filterTree(JSON.parse(JSON.stringify(fullTree))); // Deep copy to avoid mutating cache
    }, [rawItems, selectedBatchId, searchQuery]);

    // Pagination for Level 0 Subjects
    const paginatedTree = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return treeData.slice(start, start + pageSize);
    }, [treeData, currentPage]);

    const totalPages = Math.ceil(treeData.length / pageSize);

    const toggleAll = (expand) => {
        if (expand) {
            setExpandedIds(new Set(rawItems.map(i => i.id)));
        } else {
            setExpandedIds(new Set(rawItems.filter(i => !i.parent_id).map(i => i.id)));
        }
    };


    const toggleExpand = (id) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const openCreate = (parent = null) => {
        setEditingItem(null);
        setForm({
            title: '',
            parentId: parent?.id || null,
            level: parent ? parent.level + 1 : 0,
            batchId: parent ? parent.batch_id : selectedBatchId
        });
        setShowModal(true);
    };

    const openEdit = (item) => {
        setEditingItem(item);
        setForm({
            title: item.title,
            parentId: item.parent_id,
            level: item.level,
            batchId: item.batch_id
        });
        setShowModal(true);
    };

    async function handleSave(e) {
        e.preventDefault();
        try {
            const payload = {
                teacher_id: userProfile.id,
                title: form.title,
                parent_id: form.parentId,
                level: form.level,
                batch_id: form.batchId,
                order_index: editingItem ? editingItem.order_index : 0
            };
            if (editingItem) payload.id = editingItem.id;

            await lessonPlanService.saveHierarchyItem(payload);
            toast.success(editingItem ? 'Updated!' : 'Added!');
            setShowModal(false);
            loadData();
        } catch (err) {
            console.error(err);
            toast.error('Could not save item');
        }
    }

    async function handleDelete(id) {
        if (!confirm('This will delete this item and ALL its sub-topics. Proceed?')) return;
        try {
            await lessonPlanService.deleteHierarchyItem(id);
            toast.success('Deleted');
            loadData();
        } catch (err) {
            console.error(err);
            toast.error('Delete failed');
        }
    }

    const renderTreeItem = (item, depth = 0) => {
        const isExpanded = expandedIds.has(item.id);
        const hasChildren = item.children && item.children.length > 0;
        
        // Skip if search doesn't match and no children match
        if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) {
            const childrenMatch = (nodes) => nodes.some(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()) || childrenMatch(n.children));
            if (!childrenMatch(item.children)) return null;
        }

        const levelInfo = [
            { label: 'SUBJECT', color: 'var(--color-primary)' },
            { label: 'UNIT', color: 'var(--color-teal)' },
            { label: 'LESSON', color: 'var(--color-warning)' },
            { label: 'TOPIC', color: 'var(--color-accent)' },
        ][item.level] || { label: 'ITEM', color: 'var(--color-text-muted)' };

        return (
            <div key={item.id} style={{ marginLeft: depth > 0 ? '24px' : '0' }}>
                <div className={`tree-row level-${item.level} ${isExpanded ? 'active-row' : ''}`} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '10px 16px', 
                    borderRadius: '12px',
                    marginBottom: '4px',
                    background: isExpanded && depth === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
                    border: '1px solid transparent',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '12px', overflow: 'hidden' }}>
                        <button 
                            onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
                            style={{ 
                                padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
                                color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', opacity: hasChildren ? 1 : 0.2,
                                pointerEvents: hasChildren ? 'auto' : 'none'
                            }}
                        >
                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>

                        <div style={{ 
                            fontSize: '9px', fontWeight: 900, color: levelInfo.color, 
                            background: `${levelInfo.color}15`, padding: '2px 8px', borderRadius: '6px',
                            minWidth: '60px', textAlign: 'center', flexShrink: 0, textTransform: 'uppercase'
                        }}>
                            {levelInfo.label}
                        </div>

                        <span style={{ 
                            fontSize: item.level === 0 ? '16px' : '14px', 
                            fontWeight: item.level === 0 ? 800 : 500,
                            color: item.level === 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {item.title}
                        </span>
                    </div>

                    <div className="tree-actions" style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => openCreate(item)} className="btn btn-ghost btn-icon btn-sm-action" title="Add Sub-topic"><Plus size={14} /></button>
                        <button onClick={() => openEdit(item)} className="btn btn-ghost btn-icon btn-sm-action"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(item.id)} className="btn btn-ghost btn-icon btn-sm-action text-danger"><Trash2 size={14} /></button>
                    </div>
                </div>

                {isExpanded && hasChildren && (
                    <div className="tree-children" style={{ borderLeft: '1px dashed rgba(255,255,255,0.1)', marginLeft: '8px' }}>
                        {item.children.map(child => renderTreeItem(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 'var(--space-12)' }}>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: 'var(--space-8)' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', borderRadius: '12px' }}>
                            <BookCheck size={24} />
                        </div>
                        <h1 className="page-title" style={{ margin: 0 }}>Syllabus Workspace</h1>
                    </div>
                    <p className="page-subtitle">Build your hierarchical lesson templates for English papers</p>
                </div>
                <button className="btn btn-primary" onClick={() => openCreate(null)}>
                    <Plus size={20} /> New Subject
                </button>
            </div>

            {/* Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 'var(--space-4)', marginBottom: 'var(--space-8)', alignItems: 'center' }}>
                <div className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(255,255,255,0.05)', flex: 1 }}>
                    <Search size={18} color="var(--color-text-muted)" />
                    <input 
                        className="form-input" 
                        placeholder="Search syllabus..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ background: 'transparent', border: 'none', height: '100%', padding: 0, fontWeight: 600, flex: 1 }}
                    />
                </div>

                <select 
                    className="form-select" 
                    value={selectedBatchId} 
                    onChange={(e) => { setSelectedBatchId(e.target.value); setCurrentPage(1); }}
                    style={{ width: '220px', height: '52px', borderRadius: '14px', fontWeight: 700 }}
                >
                    <option value="">Select Batch...</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-ghost" onClick={() => toggleAll(true)} style={{ fontSize: '11px', fontWeight: 800 }}>Expand All</button>
                    <button className="btn btn-ghost" onClick={() => toggleAll(false)} style={{ fontSize: '11px', fontWeight: 800 }}>Collapse All</button>
                </div>
            </div>

            {/* Tree View */}
            <div className="glass-card" style={{ padding: 'var(--space-8)', minHeight: '500px', background: 'rgba(255, 255, 255, 0.01)' }}>
                {paginatedTree.length === 0 ? (
                    <div className="empty-state" style={{ padding: '100px 0' }}>
                        <Layers size={48} style={{ opacity: 0.1, marginBottom: '20px' }} />
                        <h3 style={{ fontSize: '20px', fontWeight: 800 }}>{selectedBatchId ? 'No Syllabus Items' : 'Select a Batch First'}</h3>
                        <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '12px auto' }}>
                            {selectedBatchId 
                                ? 'Start building your curriculum hierarchy for this batch.' 
                                : 'Choose a batch from the dropdown above to manage its specific syllabus.'}
                        </p>
                        {selectedBatchId && (
                            <button className="btn btn-primary btn-comfort" onClick={() => openCreate(null)} style={{ marginTop: '20px', borderRadius: '14px' }}>
                                <Plus size={18} /> Add Top Level Unit
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="tree-container">
                        {paginatedTree.map(item => renderTreeItem(item))}
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px', gap: '12px' }}>
                    <button 
                        className="btn btn-ghost" 
                        disabled={currentPage === 1} 
                        onClick={() => setCurrentPage(p => p - 1)}
                        style={{ borderRadius: '12px' }}
                    >
                        Previous
                    </button>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {Array.from({ length: totalPages }).map((_, i) => (
                            <button 
                                key={i}
                                onClick={() => setCurrentPage(i + 1)}
                                style={{ 
                                    width: '40px', height: '40px', borderRadius: '10px', fontSize: '14px', fontWeight: 900,
                                    background: currentPage === i + 1 ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
                                    color: 'white', border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>
                    <button 
                        className="btn btn-ghost" 
                        disabled={currentPage === totalPages} 
                        onClick={() => setCurrentPage(p => p + 1)}
                        style={{ borderRadius: '12px' }}
                    >
                        Next
                    </button>
                </div>
            )}

            <style>{`
                .tree-row {
                    transition: all 0.2s ease;
                }
                .tree-row:hover {
                    background: rgba(255,255,255,0.05) !important;
                    border: 1px solid rgba(59, 130, 246, 0.2) !important;
                }
                .tree-actions {
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }
                .tree-row:hover .tree-actions {
                    opacity: 1;
                }
                .tree-container {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .btn-sm-action {
                    width: 32px !important;
                    height: 32px !important;
                    padding: 0 !important;
                    background: rgba(255,255,255,0.02) !important;
                }
                .btn-sm-action:hover {
                    background: rgba(59, 130, 246, 0.1) !important;
                    color: var(--color-primary) !important;
                }
                .loading-page {
                    height: 60vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
            `}</style>

            {/* Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingItem ? 'Edit Lesson Item' : 'Add Lesson Item'}
                maxWidth="480px"
            >
                <form onSubmit={handleSave} style={{ padding: 'var(--space-2)' }}>
                    {form.parentId && (
                        <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', marginBottom: '20px' }}>
                            <Info size={14} /> 
                            <span>Adding sub-topic to: <strong>{rawItems.find(i => i.id === form.parentId)?.title}</strong></span>
                        </div>
                    )}
                    <div className="form-group" style={{ marginBottom: '24px' }}>
                        <label className="form-label">Title / Name *</label>
                        <input 
                            className="form-input" 
                            value={form.title} 
                            onChange={e => setForm({ ...form, title: e.target.value })} 
                            placeholder={form.level === 0 ? "e.g. English 1st Paper" : "e.g. Unit 1: People or Institutions"}
                            required 
                            autoFocus
                        />
                    </div>
                    {!form.parentId && (
                        <div className="form-group">
                            <label className="form-label">Category / Subject Label</label>
                            <input 
                                className="form-input" 
                                value={form.subjectType} 
                                onChange={e => setForm({ ...form, subjectType: e.target.value })} 
                                placeholder="e.g. English 1st"
                            />
                        </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: '12px', marginTop: 'var(--space-8)' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 2, boxShadow: 'var(--shadow-primary)' }}>
                            {editingItem ? 'Save Changes' : 'Create Item'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
