import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout';
import api from '../../api/client';
import toast from 'react-hot-toast';

function SmartSelect({ label, value, onChange, options, displayKey = 'name', codeKey = 'code', placeholder, onAddNew, addLabel }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setShowAdd(false); } };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selected = options.find(o => o.id === value);
    const filtered = options.filter(o => {
        const q = search.toLowerCase();
        return (o[displayKey] || '').toLowerCase().includes(q) || (o[codeKey] || '').toLowerCase().includes(q);
    });

    return (
        <div className="form-group">
            <label className="form-label">{label}</label>
            <div className="smart-select" ref={ref}>
                <div className={`smart-select-trigger form-control ${open ? 'focus' : ''}`} onClick={() => { setOpen(!open); setSearch(''); }}>
                    {selected ? (
                        <span>{selected[displayKey]} {selected[codeKey] ? <span className="text-muted">({selected[codeKey]})</span> : ''}</span>
                    ) : (
                        <span className="text-muted">{placeholder || 'Select...'}</span>
                    )}
                    <span className="smart-select-arrow">{open ? '\u25B4' : '\u25BE'}</span>
                </div>

                {open && (
                    <div className="smart-select-dropdown">
                        <div className="smart-select-search">
                            <input className="form-control" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} autoFocus onClick={e => e.stopPropagation()} />
                        </div>
                        <div className="smart-select-options">
                            {value && (
                                <div className="smart-select-option clear-option" onClick={() => { onChange(''); setOpen(false); }}>Clear selection</div>
                            )}
                            {filtered.length === 0 && <div className="smart-select-empty">No matches found</div>}
                            {filtered.map(o => (
                                <div key={o.id} className={`smart-select-option ${o.id === value ? 'selected' : ''}`} onClick={() => { onChange(o.id); setOpen(false); setSearch(''); }}>
                                    <span className="font-semibold">{o[displayKey]}</span>
                                    {o[codeKey] && <span className="text-xs text-muted" style={{ marginLeft: 6 }}>({o[codeKey]})</span>}
                                </div>
                            ))}
                        </div>
                        {onAddNew && (
                            <div className="smart-select-add" onClick={(e) => { e.stopPropagation(); setShowAdd(true); setOpen(false); }}>
                                + {addLabel || 'Add New'}
                            </div>
                        )}
                    </div>
                )}

                {showAdd && onAddNew && (
                    <div className="smart-select-inline-form">
                        {onAddNew({ onDone: (newId) => { onChange(newId); setShowAdd(false); }, onCancel: () => setShowAdd(false) })}
                    </div>
                )}
            </div>
        </div>
    );
}

function AddBuyerInline({ onDone, onCancel, onBuyersUpdated }) {
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) { toast.error('Buyer name is required'); return; }
        setSaving(true);
        try {
            const res = await api.post('/master/buyers', { name: name.trim(), contact_details: contact });
            toast.success(`Buyer "${res.data.name}" added`);
            onBuyersUpdated();
            onDone(res.data.id);
        } catch (err) { toast.error(err.response?.data?.error || 'Failed to add buyer'); }
        finally { setSaving(false); }
    };

    return (
        <div className="inline-add-form">
            <div className="inline-add-header">
                <span className="font-semibold">Add New Buyer</span>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={onCancel}>&times;</button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
                <input className="form-control" placeholder="Buyer Name *" value={name} onChange={e => setName(e.target.value)} autoFocus style={{ flex: 2 }} />
                <input className="form-control" placeholder="Contact (optional)" value={contact} onChange={e => setContact(e.target.value)} style={{ flex: 1 }} />
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                    {saving ? <span className="spinner-inline"></span> : 'Add'}
                </button>
            </div>
            <div className="text-xs text-muted mt-1">Code will be auto-generated</div>
        </div>
    );
}

function AddOrderInline({ onDone, onCancel, buyerId, onOrdersUpdated }) {
    const [style, setStyle] = useState('');
    const [season, setSeason] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await api.post('/master/orders', { buyer_id: buyerId, style, season });
            toast.success(`Order ${res.data.order_no} created`);
            onOrdersUpdated();
            onDone(res.data.id);
        } catch (err) { toast.error(err.response?.data?.error || 'Failed to create order'); }
        finally { setSaving(false); }
    };

    return (
        <div className="inline-add-form">
            <div className="inline-add-header">
                <span className="font-semibold">Add New Order</span>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={onCancel}>&times;</button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
                <input className="form-control" placeholder="Style (e.g. Men Casual Shirt)" value={style} onChange={e => setStyle(e.target.value)} autoFocus style={{ flex: 2 }} />
                <input className="form-control" placeholder="Season (e.g. SS-2026)" value={season} onChange={e => setSeason(e.target.value)} style={{ flex: 1 }} />
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                    {saving ? <span className="spinner-inline"></span> : 'Add'}
                </button>
            </div>
            <div className="text-xs text-muted mt-1">Order number will be auto-generated</div>
        </div>
    );
}

function AddVendorInline({ onDone, onCancel, onVendorsUpdated }) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) { toast.error('Vendor name is required'); return; }
        setSaving(true);
        try {
            const res = await api.post('/vendors', { name: name.trim(), phone, email });
            toast.success(`Vendor "${res.data.name}" added`);
            onVendorsUpdated();
            onDone(res.data.id);
        } catch (err) { toast.error(err.response?.data?.error || 'Failed to add vendor'); }
        finally { setSaving(false); }
    };

    return (
        <div className="inline-add-form">
            <div className="inline-add-header">
                <span className="font-semibold">Add New Vendor</span>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={onCancel}>&times;</button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
                <input className="form-control" placeholder="Vendor Name *" value={name} onChange={e => setName(e.target.value)} autoFocus style={{ flex: 2 }} />
                <input className="form-control" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} style={{ flex: 1 }} />
                <input className="form-control" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ flex: 1 }} />
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                    {saving ? <span className="spinner-inline"></span> : 'Add'}
                </button>
            </div>
        </div>
    );
}

function AddMaterialInline({ onDone, onCancel, onMaterialsUpdated }) {
    const [name, setName] = useState('');
    const [unit, setUnit] = useState('piece');
    const [rate, setRate] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) { toast.error('Material name is required'); return; }
        setSaving(true);
        try {
            const res = await api.post('/master/materials', { name: name.trim(), unit_of_measure: unit, default_rate: rate ? Number(rate) : null });
            toast.success(`Material "${res.data.name}" added`);
            onMaterialsUpdated();
            onDone(res.data.id);
        } catch (err) { toast.error(err.response?.data?.error || 'Failed to add material'); }
        finally { setSaving(false); }
    };

    return (
        <div className="inline-add-form">
            <div className="inline-add-header">
                <span className="font-semibold">Add New Material</span>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={onCancel}>&times;</button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
                <input className="form-control" placeholder="Material Name *" value={name} onChange={e => setName(e.target.value)} autoFocus style={{ flex: 2 }} />
                <select className="form-control" value={unit} onChange={e => setUnit(e.target.value)} style={{ flex: 1 }}>
                    <option value="piece">piece</option>
                    <option value="meter">meter</option>
                    <option value="kg">kg</option>
                    <option value="litre">litre</option>
                    <option value="cone">cone</option>
                    <option value="set">set</option>
                    <option value="roll">roll</option>
                    <option value="pack">pack</option>
                </select>
                <input type="number" className="form-control" placeholder="Default Rate" value={rate} onChange={e => setRate(e.target.value)} style={{ flex: 1 }} />
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                    {saving ? <span className="spinner-inline"></span> : 'Add'}
                </button>
            </div>
        </div>
    );
}

// Inline SmartSelect for table cells (material column)
function MaterialCellSelect({ value, onChange, materials, onMaterialsUpdated }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setShowAdd(false); } };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selected = materials.find(m => m.id === value);
    const filtered = materials.filter(m => {
        const q = search.toLowerCase();
        return (m.name || '').toLowerCase().includes(q) || (m.category || '').toLowerCase().includes(q);
    });

    return (
        <div className="smart-select" ref={ref} style={{ minWidth: 160 }}>
            <div className={`smart-select-trigger form-control ${open ? 'focus' : ''}`} onClick={() => { setOpen(!open); setSearch(''); }} style={{ fontSize: 12, padding: '4px 8px' }}>
                {selected ? (
                    <span>{selected.name} <span className="text-muted">({selected.unit_of_measure})</span></span>
                ) : (
                    <span className="text-muted">Select...</span>
                )}
                <span className="smart-select-arrow">{open ? '\u25B4' : '\u25BE'}</span>
            </div>

            {open && (
                <div className="smart-select-dropdown">
                    <div className="smart-select-search">
                        <input className="form-control" placeholder="Search material..." value={search} onChange={e => setSearch(e.target.value)} autoFocus onClick={e => e.stopPropagation()} />
                    </div>
                    <div className="smart-select-options">
                        {value && (
                            <div className="smart-select-option clear-option" onClick={() => { onChange(''); setOpen(false); }}>Clear</div>
                        )}
                        {filtered.length === 0 && <div className="smart-select-empty">No matches</div>}
                        {filtered.map(m => (
                            <div key={m.id} className={`smart-select-option ${m.id === value ? 'selected' : ''}`} onClick={() => { onChange(m.id); setOpen(false); setSearch(''); }}>
                                <span className="font-semibold">{m.name}</span>
                                <span className="text-xs text-muted" style={{ marginLeft: 6 }}>({m.unit_of_measure})</span>
                            </div>
                        ))}
                    </div>
                    <div className="smart-select-add" onClick={(e) => { e.stopPropagation(); setShowAdd(true); setOpen(false); }}>
                        + Add New Material
                    </div>
                </div>
            )}

            {showAdd && (
                <div className="smart-select-inline-form">
                    <AddMaterialInline
                        onDone={(newId) => { onChange(newId); setShowAdd(false); }}
                        onCancel={() => setShowAdd(false)}
                        onMaterialsUpdated={onMaterialsUpdated}
                    />
                </div>
            )}
        </div>
    );
}

export default function NewRequest() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = !!id;

    const [buyers, setBuyers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const [form, setForm] = useState({
        buyer_id: '', order_id: '', department: '', requested_date: new Date().toISOString().split('T')[0],
        expected_purchase_date: '', preferred_vendor_id: '', notes: '',
        lines: [{ material_id: '', description: '', quantity: 1, expected_rate: '', remarks: '' }]
    });

    const loadBuyers = () => api.get('/master/buyers').then(r => setBuyers(r.data));
    const loadOrders = () => {
        if (form.buyer_id) api.get(`/master/orders?buyer_id=${form.buyer_id}`).then(r => setOrders(r.data));
        else setOrders([]);
    };
    const loadVendors = () => api.get('/vendors?active=true').then(r => setVendors(r.data));
    const loadMaterials = () => api.get('/master/materials').then(r => setMaterials(r.data));

    useEffect(() => {
        Promise.all([
            api.get('/master/buyers'),
            api.get('/master/materials'),
            api.get('/vendors?active=true'),
        ]).then(([b, m, v]) => { setBuyers(b.data); setMaterials(m.data); setVendors(v.data); });
    }, []);

    useEffect(() => { loadOrders(); }, [form.buyer_id]);

    useEffect(() => {
        if (isEdit) {
            api.get(`/requests/${id}`).then(r => {
                const req = r.data;
                setForm({
                    buyer_id: req.buyer_id || '', order_id: req.order_id || '', department: req.department || '',
                    requested_date: req.requested_date, expected_purchase_date: req.expected_purchase_date || '',
                    preferred_vendor_id: req.preferred_vendor_id || '', notes: req.notes || '',
                    lines: req.lines.map(l => ({ material_id: l.material_id || '', description: l.description || '', quantity: l.quantity, expected_rate: l.expected_rate || '', remarks: l.remarks || '' }))
                });
            });
        }
    }, [id]);

    const setLine = (i, field, value) => {
        setForm(f => {
            const lines = [...f.lines];
            lines[i] = { ...lines[i], [field]: value };
            if (field === 'material_id' && value) {
                const mat = materials.find(m => m.id === value);
                if (mat?.default_rate) lines[i].expected_rate = mat.default_rate;
            }
            return { ...f, lines };
        });
    };

    const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, { material_id: '', description: '', quantity: 1, expected_rate: '', remarks: '' }] }));
    const removeLine = (i) => setForm(f => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }));

    const totalExpected = form.lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.expected_rate) || 0), 0);

    const validate = () => {
        const errs = {};
        if (form.lines.length === 0) errs.lines = 'At least one line item is required';
        const hasValidLine = form.lines.some(l => l.material_id || l.description);
        if (!hasValidLine) errs.lines = 'At least one line must have a material or description';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // Convert empty strings to null for FK fields to prevent FK constraint errors
    const nullify = v => (v === '' || v === undefined) ? null : v;

    const handleSave = async (status) => {
        if (!validate()) return;
        setLoading(true);
        try {
            const payload = {
                ...form,
                buyer_id: nullify(form.buyer_id),
                order_id: nullify(form.order_id),
                preferred_vendor_id: nullify(form.preferred_vendor_id),
                lines: form.lines.map(l => ({
                    ...l,
                    material_id: nullify(l.material_id),
                    quantity: Number(l.quantity),
                    expected_rate: Number(l.expected_rate) || 0
                }))
            };
            if (isEdit) {
                await api.patch(`/requests/${id}`, { ...payload, status });
                toast.success('Request updated');
            } else {
                const res = await api.post('/requests', payload);
                if (status === 'PENDING_PURCHASE') await api.patch(`/requests/${res.data.id}`, { status: 'PENDING_PURCHASE' });
                toast.success(`Request ${res.data.request_no} created`);
            }
            navigate('/requests');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save request');
        } finally { setLoading(false); }
    };

    return (
        <AppLayout pageTitle={isEdit ? 'Edit Request' : 'New Material Request'}>
            <div className="page-header">
                <div>
                    <div className="page-header-title">{isEdit ? 'Edit Material Request' : 'New Material Request'}</div>
                    <div className="page-header-sub">Fill in material details for procurement</div>
                </div>
            </div>

            <div className="card mb-4">
                <div className="card-title mb-3">Request Details</div>
                <div className="form-row">
                    <SmartSelect label="Buyer" value={form.buyer_id} onChange={v => setForm(f => ({ ...f, buyer_id: v, order_id: '' }))} options={buyers} displayKey="name" codeKey="code" placeholder="Select or Add Buyer" addLabel="Add New Buyer"
                        onAddNew={({ onDone, onCancel }) => (<AddBuyerInline onDone={onDone} onCancel={onCancel} onBuyersUpdated={loadBuyers} />)} />
                    <SmartSelect label="Order" value={form.order_id} onChange={v => setForm(f => ({ ...f, order_id: v }))} options={orders.map(o => ({ ...o, name: `${o.order_no} \u2013 ${o.style || 'No style'}` }))} displayKey="name" codeKey="order_no" placeholder={form.buyer_id ? 'Select or Add Order' : 'Select buyer first'} addLabel="Add New Order"
                        onAddNew={form.buyer_id ? ({ onDone, onCancel }) => (<AddOrderInline onDone={onDone} onCancel={onCancel} buyerId={form.buyer_id} onOrdersUpdated={loadOrders} />) : undefined} />
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Department / Store</label>
                        <input className="form-control" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g. Cutting Dept" />
                    </div>
                    <SmartSelect label="Preferred Vendor" value={form.preferred_vendor_id} onChange={v => setForm(f => ({ ...f, preferred_vendor_id: v }))} options={vendors} displayKey="name" codeKey="" placeholder="Any Vendor" addLabel="Add New Vendor"
                        onAddNew={({ onDone, onCancel }) => (<AddVendorInline onDone={onDone} onCancel={onCancel} onVendorsUpdated={loadVendors} />)} />
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Request Date</label>
                        <input type="date" className="form-control" value={form.requested_date} onChange={e => setForm(f => ({ ...f, requested_date: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Expected Purchase Date</label>
                        <input type="date" className="form-control" value={form.expected_purchase_date} onChange={e => setForm(f => ({ ...f, expected_purchase_date: e.target.value }))} />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Special instructions" />
                </div>
            </div>

            <div className="card mb-4">
                <div className="card-header">
                    <div className="card-title">Line Items</div>
                    <button className="btn btn-secondary btn-sm" onClick={addLine}>+ Add Item</button>
                </div>
                {errors.lines && <div className="form-error mb-2">{errors.lines}</div>}
                <div className="table-wrap">
                    <table className="line-items-table">
                        <thead>
                            <tr>
                                <th style={{ width: '22%' }}>Material</th>
                                <th style={{ width: '25%' }}>Description</th>
                                <th style={{ width: '10%' }}>Qty</th>
                                <th style={{ width: '13%' }}>Rate</th>
                                <th style={{ width: '13%' }}>Amount</th>
                                <th style={{ width: '12%' }}>Remarks</th>
                                <th style={{ width: '5%' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {form.lines.map((l, i) => (
                                <tr key={i}>
                                    <td>
                                        <MaterialCellSelect
                                            value={l.material_id}
                                            onChange={v => setLine(i, 'material_id', v)}
                                            materials={materials}
                                            onMaterialsUpdated={loadMaterials}
                                        />
                                    </td>
                                    <td><input className="form-control" value={l.description} onChange={e => setLine(i, 'description', e.target.value)} placeholder="Details..." /></td>
                                    <td><input type="number" className="form-control" min="0.01" step="0.01" value={l.quantity} onChange={e => setLine(i, 'quantity', e.target.value)} /></td>
                                    <td><input type="number" className="form-control" min="0" step="0.01" value={l.expected_rate} onChange={e => setLine(i, 'expected_rate', e.target.value)} /></td>
                                    <td className="font-semibold">{'\u20B9'}{((Number(l.quantity) || 0) * (Number(l.expected_rate) || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                    <td><input className="form-control" value={l.remarks} onChange={e => setLine(i, 'remarks', e.target.value)} /></td>
                                    <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeLine(i)} disabled={form.lines.length === 1}>&times;</button></td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={4} className="text-right font-semibold" style={{ padding: '8px 10px' }}>Total Expected:</td>
                                <td className="font-bold text-primary" style={{ padding: '8px 10px' }}>{'\u20B9'}{totalExpected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                <td colSpan={2}></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => navigate('/requests')} disabled={loading}>Cancel</button>
                <button className="btn btn-secondary" onClick={() => handleSave('DRAFT')} disabled={loading}>Save as Draft</button>
                <button className="btn btn-primary" onClick={() => handleSave('PENDING_PURCHASE')} disabled={loading}>
                    {loading ? <><span className="spinner-inline"></span> Saving...</> : 'Submit Request'}
                </button>
            </div>
        </AppLayout>
    );
}
