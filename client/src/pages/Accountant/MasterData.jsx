import { useState, useEffect } from 'react';
import AppLayout from '../../layouts/AppLayout';
import api from '../../api/client';
import toast from 'react-hot-toast';

const ENTITY_TABS = [
    { key: 'vendors', label: 'Vendors', endpoint: '/vendors' },
    { key: 'buyers', label: 'Buyers', endpoint: '/master/buyers' },
    { key: 'orders', label: 'Orders', endpoint: '/master/orders' },
    { key: 'materials', label: 'Materials', endpoint: '/master/materials' },
];

export default function MasterData() {
    const [activeTab, setActiveTab] = useState('vendors');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [buyers, setBuyers] = useState([]);

    const currentTab = ENTITY_TABS.find(t => t.key === activeTab);

    const load = () => {
        setLoading(true);
        api.get(currentTab.endpoint).then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
        if (activeTab === 'orders') api.get('/master/buyers').then(r => setBuyers(r.data));
    };
    useEffect(() => { load(); setShowForm(false); setEditItem(null); }, [activeTab]);

    const handleSave = async (formData) => {
        try {
            if (editItem) {
                await api.patch(`${currentTab.endpoint}/${editItem.id}`, formData);
                toast.success('Record updated');
            } else {
                await api.post(currentTab.endpoint, formData);
                toast.success('Record created');
            }
            setShowForm(false);
            setEditItem(null);
            load();
        } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this item?')) return;
        try {
            await api.delete(`${currentTab.endpoint}/${id}`);
            toast.success('Deleted');
            load();
        } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    };

    const startEdit = (item) => { setEditItem(item); setShowForm(true); };
    const startNew = () => { setEditItem(null); setShowForm(true); };

    return (
        <AppLayout pageTitle="Master Data">
            <div className="page-header">
                <div>
                    <div className="page-header-title">Master Data Management</div>
                    <div className="page-header-sub">Manage vendors, buyers, orders, and materials</div>
                </div>
                <button className="btn btn-primary" onClick={startNew}>+ New {activeTab.slice(0, -1)}</button>
            </div>

            <div className="tabs mb-4">
                {ENTITY_TABS.map(t => (
                    <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
                        {t.label}
                    </button>
                ))}
            </div>

            {showForm && (
                <div className="card mb-4" style={{ borderLeft: '3px solid var(--color-primary)' }}>
                    <div className="card-title mb-4">{editItem ? 'Edit' : 'New'} {activeTab.slice(0, -1)}</div>
                    <EntityForm entity={activeTab} item={editItem} buyers={buyers} onSave={handleSave} onCancel={() => { setShowForm(false); setEditItem(null); }} />
                </div>
            )}

            <div className="card" style={{ padding: 0 }}>
                {loading ? <div className="spinner-wrap"><div className="spinner"></div></div> :
                    data.length === 0 ? (
                        <div className="empty-state"><div className="empty-title">No {activeTab} found</div></div>
                    ) : (
                        <div className="table-wrap">
                            <EntityTable entity={activeTab} data={data} onEdit={startEdit} onDelete={activeTab === 'vendors' ? handleDelete : undefined} />
                        </div>
                    )
                }
            </div>
        </AppLayout>
    );
}

function EntityForm({ entity, item, buyers, onSave, onCancel }) {
    const [form, setForm] = useState({});
    useEffect(() => { setForm(item || {}); }, [item]);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const fields = {
        vendors: [
            { key: 'name', label: 'Name *', required: true },
            { key: 'contact_person', label: 'Contact Person' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' },
            { key: 'address', label: 'Address' },
            { key: 'gstin', label: 'GSTIN' },
            { key: 'notes', label: 'Notes' },
        ],
        buyers: [
            { key: 'name', label: 'Name *', required: true },
            { key: 'code', label: 'Code' },
            { key: 'contact_details', label: 'Contact Details' },
            { key: 'notes', label: 'Notes' },
        ],
        orders: [
            { key: 'order_no', label: 'Order No *', required: true },
            { key: 'buyer_id', label: 'Buyer *', type: 'select', options: buyers, required: true },
            { key: 'style', label: 'Style' },
            { key: 'season', label: 'Season' },
            { key: 'start_date', label: 'Start Date', type: 'date' },
            { key: 'end_date', label: 'End Date', type: 'date' },
        ],
        materials: [
            { key: 'name', label: 'Name *', required: true },
            { key: 'category', label: 'Category' },
            { key: 'unit_of_measure', label: 'Unit (e.g. metre, kg, piece)' },
            { key: 'default_rate', label: 'Default Rate ₹', type: 'number' },
            { key: 'notes', label: 'Notes' },
        ],
    };

    return (
        <div>
            <div className="form-row" style={{ flexWrap: 'wrap' }}>
                {fields[entity]?.map(f => (
                    <div className="form-group" key={f.key} style={{ minWidth: 200 }}>
                        <label className="form-label">{f.label}</label>
                        {f.type === 'select' ? (
                            <select className="form-control" value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)}>
                                <option value="">Select...</option>
                                {f.options?.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                        ) : (
                            <input type={f.type || 'text'} className="form-control" value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} required={f.required} />
                        )}
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                <button className="btn btn-primary" onClick={() => onSave(form)}>{item ? 'Update' : 'Create'}</button>
            </div>
        </div>
    );
}

function EntityTable({ entity, data, onEdit, onDelete }) {
    const columns = {
        vendors: [
            { key: 'name', label: 'Name' },
            { key: 'contact_person', label: 'Contact' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' },
            { key: 'address', label: 'Address' },
            { key: 'gstin', label: 'GSTIN' },
        ],
        buyers: [
            { key: 'name', label: 'Name' },
            { key: 'code', label: 'Code' },
            { key: 'contact_details', label: 'Contact' },
        ],
        orders: [
            { key: 'order_no', label: 'Order No' },
            { key: 'buyer_name', label: 'Buyer' },
            { key: 'style', label: 'Style' },
            { key: 'season', label: 'Season' },
            { key: 'status', label: 'Status' },
        ],
        materials: [
            { key: 'name', label: 'Name' },
            { key: 'category', label: 'Category' },
            { key: 'unit_of_measure', label: 'Unit' },
            { key: 'default_rate', label: 'Rate ₹', format: v => v ? `₹${Number(v).toLocaleString('en-IN')}` : '—' },
        ],
    };

    const cols = columns[entity] || [];

    return (
        <table>
            <thead>
                <tr>{cols.map(c => <th key={c.key}>{c.label}</th>)}<th>Actions</th></tr>
            </thead>
            <tbody>
                {data.map(row => (
                    <tr key={row.id}>
                        {cols.map(c => <td key={c.key}>{c.format ? c.format(row[c.key]) : (row[c.key] || '—')}</td>)}
                        <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => onEdit(row)}>Edit</button>
                                {onDelete && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => onDelete(row.id)}>Delete</button>}
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
