import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';

function SmartSelect({ label, value, onChange, options, displayKey = 'name', codeKey = 'code', placeholder, onAddNew, addLabel, required, error }) {
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
            <label className="form-label">{label} {required && <span className="required">*</span>}</label>
            <div className="smart-select" ref={ref}>
                <div className={`smart-select-trigger form-control ${open ? 'focus' : ''} ${error ? 'is-invalid' : ''}`} onClick={() => { setOpen(!open); setSearch(''); }}>
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
            {error && <div className="form-error">{error}</div>}
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

export default function CreatePurchase() {
    const { id: requestId } = useParams();
    const navigate = useNavigate();
    const [request, setRequest] = useState(null);
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    const [form, setForm] = useState({
        vendor_id: '', invoice_no: '', invoice_date: new Date().toISOString().split('T')[0],
        total_invoice_amount: '', notes: '', invoice_type_submitted: 'TAX_INVOICE',
        lines: []
    });
    const [invoiceFile, setInvoiceFile] = useState(null);

    const loadVendors = () => api.get('/vendors?active=true').then(r => setVendors(r.data));

    useEffect(() => {
        Promise.all([
            api.get(`/requests/${requestId}`),
            api.get('/vendors?active=true'),
        ]).then(([r, v]) => {
            setRequest(r.data);
            setVendors(v.data);
            setForm(f => ({
                ...f,
                vendor_id: r.data.preferred_vendor_id || '',
                lines: r.data.lines.map(l => ({
                    material_id: l.material_id || '',
                    description: l.description || l.material_name || '',
                    quantity: l.quantity,
                    actual_rate: l.expected_rate || '',
                    expected_rate: l.expected_rate || 0,
                    material_name: l.material_name || '',
                    unit_of_measure: l.unit_of_measure || ''
                }))
            }));
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [requestId]);

    const setLine = (i, field, value) => {
        setForm(f => {
            const lines = [...f.lines];
            lines[i] = { ...lines[i], [field]: value };
            return { ...f, lines };
        });
    };

    const totalInvoice = form.lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.actual_rate) || 0), 0);

    const onDrop = useCallback(files => { if (files[0]) setInvoiceFile(files[0]); }, []);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop, accept: { 'image/*': ['.jpg', '.jpeg', '.png'], 'application/pdf': ['.pdf'] }, maxFiles: 1, maxSize: 10485760
    });

    const validate = () => {
        const errs = {};
        if (!form.vendor_id) errs.vendor_id = 'Vendor is required';
        if (!form.invoice_no) errs.invoice_no = 'Invoice number is required';
        if (totalInvoice <= 0) errs.total = 'Total invoice amount must be greater than zero';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setSubmitting(true);
        try {
            const payload = {
                material_request_id: requestId,
                vendor_id: form.vendor_id,
                invoice_no: form.invoice_no,
                invoice_date: form.invoice_date,
                total_invoice_amount: totalInvoice || Number(form.total_invoice_amount) || 0,
                notes: form.notes,
                invoice_type_submitted: form.invoice_type_submitted,
                lines: form.lines.map(l => ({
                    material_id: l.material_id, description: l.description,
                    quantity: Number(l.quantity), actual_rate: Number(l.actual_rate) || 0,
                }))
            };
            const res = await api.post('/purchases', payload);
            const purchaseId = res.data.id;

            if (invoiceFile) {
                const fd = new FormData();
                fd.append('file', invoiceFile);
                await api.post(`/purchases/${purchaseId}/invoice`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            }

            toast.success('Purchase submitted');
            navigate('/my-purchases');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create purchase');
        } finally { setSubmitting(false); }
    };

    if (loading) return <AppLayout pageTitle="Create Purchase"><div className="spinner-wrap"><div className="spinner"></div></div></AppLayout>;
    if (!request) return <AppLayout pageTitle="Create Purchase"><div className="empty-state"><div className="empty-title">Request not found</div></div></AppLayout>;

    return (
        <AppLayout pageTitle={`Purchase for ${request.request_no}`}>
            <div className="page-header">
                <div>
                    <div className="page-header-title">Create Purchase</div>
                    <div className="page-header-sub">For request {request.request_no} &middot; {request.buyer_name || 'No buyer'} &middot; {request.order_no || 'No order'}</div>
                </div>
            </div>

            <div className="card mb-4">
                <div className="card-title mb-3">Purchase Details</div>
                <div className="form-row">
                    <SmartSelect
                        label="Vendor"
                        required
                        value={form.vendor_id}
                        onChange={v => setForm(f => ({ ...f, vendor_id: v }))}
                        options={vendors}
                        displayKey="name"
                        codeKey=""
                        placeholder="Select or Add Vendor"
                        addLabel="Add New Vendor"
                        error={errors.vendor_id}
                        onAddNew={({ onDone, onCancel }) => (
                            <AddVendorInline onDone={onDone} onCancel={onCancel} onVendorsUpdated={loadVendors} />
                        )}
                    />
                    <div className="form-group">
                        <label className="form-label">Invoice Number <span className="required">*</span></label>
                        <input className={`form-control ${errors.invoice_no ? 'is-invalid' : ''}`} value={form.invoice_no} onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))} placeholder="INV-001" />
                        {errors.invoice_no && <div className="form-error">{errors.invoice_no}</div>}
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Invoice Date</label>
                        <input type="date" className="form-control" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Invoice Type <span className="required">*</span></label>
                        <select className="form-control" value={form.invoice_type_submitted} onChange={e => setForm(f => ({ ...f, invoice_type_submitted: e.target.value }))}>
                            <option value="TAX_INVOICE">Tax Invoice / Final Bill</option>
                            <option value="PROVISIONAL">Provisional Invoice / Slip</option>
                        </select>
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Notes</label>
                        <input className="form-control" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes" />
                    </div>
                </div>
            </div>

            <div className="card mb-4">
                <div className="card-title mb-3">Purchase Items</div>
                {errors.total && <div className="form-error mb-2">{errors.total}</div>}
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr><th>Material</th><th>Description</th><th>Qty</th><th>Expected Rate</th><th>Actual Rate</th><th>Amount</th></tr>
                        </thead>
                        <tbody>
                            {form.lines.map((l, i) => (
                                <tr key={i}>
                                    <td className="font-semibold">{l.material_name || '\u2014'} <span className="text-xs text-muted">{l.unit_of_measure}</span></td>
                                    <td>{l.description || '\u2014'}</td>
                                    <td><input type="number" className="form-control" style={{ width: 70 }} min="0.01" step="0.01" value={l.quantity} onChange={e => setLine(i, 'quantity', e.target.value)} /></td>
                                    <td className="text-muted">{'\u20B9'}{(l.expected_rate || 0).toLocaleString('en-IN')}</td>
                                    <td><input type="number" className="form-control" style={{ width: 90 }} min="0" step="0.01" value={l.actual_rate} onChange={e => setLine(i, 'actual_rate', e.target.value)} /></td>
                                    <td className="font-semibold">{'\u20B9'}{((Number(l.quantity) || 0) * (Number(l.actual_rate) || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={5} className="text-right font-semibold">Total Invoice Amount:</td>
                                <td className="font-bold text-primary">{'\u20B9'}{totalInvoice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <div className="card mb-4">
                <div className="card-title mb-3">{form.invoice_type_submitted === 'PROVISIONAL' ? 'Provisional Invoice / Slip' : 'Tax Invoice / Final Bill'}</div>
                <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
                    <input {...getInputProps()} />
                    {invoiceFile ? (
                        <div className="dropzone-file">
                            <span>{invoiceFile.name}</span>
                            <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setInvoiceFile(null); }}>&times;</button>
                        </div>
                    ) : (
                        <div className="dropzone-placeholder">
                            <div>Drop invoice file here or click to browse</div>
                            <div className="text-xs text-muted mt-1">Supports JPG, PNG, PDF (max 10MB)</div>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => navigate('/pending-requests')} disabled={submitting}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? <><span className="spinner-inline"></span> Submitting...</> : 'Submit Purchase'}
                </button>
            </div>
        </AppLayout>
    );
}
