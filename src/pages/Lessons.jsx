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
    const [loading, setLoading] = useState(true);
    const [expandedIds, setExpandedIds] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('English 1st Paper');

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [form, setForm] = useState({ title: '', parentId: null, level: 0, subjectType: 'English 1st Paper' });

    useEffect(() => {
        if (userProfile?.id) loadData();
    }, [userProfile]);

    async function loadData() {
        try {
            setLoading(true);
            const data = await lessonPlanService.getFullHierarchy(userProfile.id);
            setRawItems(data || []);
            
            // Auto-expand top levels if empty
            if (expandedIds.size === 0) {
                const topLevelIds = data.filter(i => !i.parent_id).map(i => i.id);
                setExpandedIds(new Set(topLevelIds));
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to load lesson plans');
        } finally {
            setLoading(false);
        }
    }

    // Tree Construction
    const treeData = useMemo(() => {
        const buildTree = (parentId = null) => {
            return rawItems
                .filter(item => item.parent_id === parentId && (parentId || item.subject_type === selectedSubject))
                .sort((a, b) => a.order_index - b.order_index)
                .map(item => ({
                    ...item,
                    children: buildTree(item.id)
                }));
        };
        return buildTree(null);
    }, [rawItems, selectedSubject]);

    const subjects = useMemo(() => {
        const set = new Set(rawItems.filter(i => !i.parent_id).map(i => i.subject_type));
        // Default subjects if none exist
        if (set.size === 0) return ['English 1st Paper', 'English 2nd Paper'];
        return Array.from(set);
    }, [rawItems]);

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
            subjectType: parent ? parent.subject_type : selectedSubject
        });
        setShowModal(true);
    };

    const openEdit = (item) => {
        setEditingItem(item);
        setForm({
            title: item.title,
            parentId: item.parent_id,
            level: item.level,
            subjectType: item.subject_type
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
                subject_type: form.subjectType,
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
                <div className="glass-panel" style={{ padding: '8px', display: 'flex', gap: '4px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                    {subjects.map(sub => (
                        <button 
                            key={sub}
                            onClick={() => setSelectedSubject(sub)}
                            style={{ 
                                padding: '10px 24px', borderRadius: '12px', fontSize: '13px', fontWeight: 800, 
                                border: 'none', cursor: 'pointer', transition: 'all 0.3s ease',
                                background: selectedSubject === sub ? 'var(--color-primary)' : 'transparent',
                                color: selectedSubject === sub ? 'white' : 'var(--color-text-muted)',
                            }}
                        >
                            {sub}
                        </button>
                    ))}
                    {subjects.length === 0 && <span style={{ padding: '10px', fontSize: '12px', opacity: 0.5 }}>No subjects found</span>}
                </div>

                <div className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Search size={18} color="var(--color-text-muted)" />
                    <input 
                        className="form-input" 
                        placeholder="Search topics..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ background: 'transparent', border: 'none', height: '100%', padding: 0, fontWeight: 600 }}
                    />
                </div>
            </div>

            {/* Tree View */}
            <div className="glass-card" style={{ padding: 'var(--space-8)', minHeight: '500px' }}>
                {treeData.length === 0 ? (
                    <div className="empty-state" style={{ padding: '100px 0' }}>
                        <Layers size={48} style={{ opacity: 0.1, marginBottom: '20px' }} />
                        <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Empty Hierarchy</h3>
                        <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '12px auto' }}>
                            Start building your curriculum for <strong>{selectedSubject}</strong>. 
                        </p>
                        <button className="btn btn-secondary" onClick={() => openCreate(null)} style={{ marginTop: '20px' }}>
                            <Plus size={18} /> Add Top Level Unit
                        </button>
                    </div>
                ) : (
                    <div className="tree-container">
                        {treeData.map(item => renderTreeItem(item))}
                    </div>
                )}
            </div>

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
