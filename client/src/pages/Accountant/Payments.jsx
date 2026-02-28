import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { StatusBadge } from '../Dashboard';
import { useDropzone } from 'react-dropzone';

export default function Payments() {
    const [searchParams] = useSearchParams();
    const preselectedPurchaseId = searchParams.get('purchase_id') || '';

    const [purchases, setPurchases] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [proofFile, setProofFile] = useState(null);
    const [showForm, setShowForm] = useState(!!preselectedPurchaseId);
    const [errors, setErrors] = useState({});

    const [form, setForm] = useState({
        purchase_id: preselectedPurchaseId,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'Cash', paid_amount: '', reference_no: '', notes: ''
    });

    useEffect(() => {
        Promise.all([
            api.get('/purchases?status=APPROVED'),
            api.get('/purchases?status=PARTIALLY_PAID'),
            api.get('/payments'),
        ]).then(([a, pp, py]) => {
            setPurchases([...a.data, ...pp.data]);
            setPayments(py.data);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const selectedPurchase = purchases.find(p => p.id === form.purchase_id);
    const existingPayments = payments.filter(p => p.purchase_id === form.purchase_id);
    const totalAlreadyPaid = existingPayments.reduce((s, p) => s + (p.paid_amount || 0), 0);
    const remaining = selectedPurchase ? (selectedPurchase.total_invoice_amount || 0) - totalAlreadyPaid : 0;

    const onDrop = useCallback(files => { if (files[0]) setProofFile(files[0]); }, []);
    const { getRootProps, getInputProps } = useDropzone({
        onDrop, accept: { 'image/*': ['.jpg', '.jpeg', '.png'], 'application/pdf': ['.pdf'] }, maxFiles: 1, maxSize: 10485760
    });

    const validate = () => {
        const errs = {};
        if (!form.purchase_id) errs.purchase_id = 'Select a purchase';
        if (!form.paid_amount || Number(form.paid_amount) <= 0) errs.paid_amount = 'Amount must be greater than zero';
        if (Number(form.paid_amount) > remaining && remaining > 0) errs.paid_amount = `Amount exceeds outstanding balance of \u20B9${remaining.toLocaleString('en-IN')}`;
        if (!form.payment_date) errs.payment_date = 'Payment date is required';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setSubmitting(true);
        try {
            const res = await api.post('/payments', {
                ...form, paid_amount: Number(form.paid_amount)
            });
            if (proofFile) {
                const fd = new FormData();
                fd.append('file', proofFile);
                await api.post(`/payments/${res.data.id}/proof`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            }
            toast.success(`Payment recorded (${res.data.status})`);
            setForm({ purchase_id: '', payment_date: new Date().toISOString().split('T')[0], payment_method: 'Cash', paid_amount: '', reference_no: '', notes: '' });
            setProofFile(null);
            setShowForm(false);
            setErrors({});
            const [a, pp, py] = await Promise.all([api.get('/purchases?status=APPROVED'), api.get('/purchases?status=PARTIALLY_PAID'), api.get('/payments')]);
            setPurchases([...a.data, ...pp.data]);
            setPayments(py.data);
        } catch (err) { toast.error(err.response?.data?.error || 'Failed to record payment'); }
        finally { setSubmitting(false); }
    };

    return (
        <AppLayout pageTitle="Payments">
            <div className="page-header">
                <div>
                    <div className="page-header-title">Payments</div>
                    <div className="page-header-sub">Record and track payment transactions</div>
                </div>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    {showForm ? 'Close' : 'New Payment'}
                </button>
            </div>

            {showForm && (
                <div className="card mb-4" style={{ borderLeft: '3px solid var(--color-primary)' }}>
                    <div className="card-title mb-3">Record Payment</div>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 2 }}>
                            <label className="form-label">Purchase <span className="required">*</span></label>
                            <select className={`form-control ${errors.purchase_id ? 'is-invalid' : ''}`} value={form.purchase_id} onChange={e => setForm(f => ({ ...f, purchase_id: e.target.value }))}>
                                <option value="">Select approved purchase...</option>
                                {purchases.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.request_no} \u2013 {p.invoice_no} \u2013 {p.vendor_name} \u2013 {'\u20B9'}{(p.total_invoice_amount || 0).toLocaleString('en-IN')} ({p.status})
                                    </option>
                                ))}
                            </select>
                            {errors.purchase_id && <div className="form-error">{errors.purchase_id}</div>}
                        </div>
                    </div>
                    {selectedPurchase && (
                        <div className="kpi-grid mb-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                            <div className="kpi-card" style={{ '--accent': '#2563eb' }}><div className="kpi-label">Invoice Total</div><div className="kpi-value" style={{ fontSize: 16 }}>{'\u20B9'}{(selectedPurchase.total_invoice_amount || 0).toLocaleString('en-IN')}</div></div>
                            <div className="kpi-card" style={{ '--accent': '#16a34a' }}><div className="kpi-label">Paid</div><div className="kpi-value" style={{ fontSize: 16 }}>{'\u20B9'}{totalAlreadyPaid.toLocaleString('en-IN')}</div></div>
                            <div className="kpi-card" style={{ '--accent': remaining > 0 ? '#dc2626' : '#16a34a' }}><div className="kpi-label">Outstanding</div><div className="kpi-value" style={{ fontSize: 16 }}>{'\u20B9'}{remaining.toLocaleString('en-IN')}</div></div>
                        </div>
                    )}
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Payment Date <span className="required">*</span></label>
                            <input type="date" className={`form-control ${errors.payment_date ? 'is-invalid' : ''}`} value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
                            {errors.payment_date && <div className="form-error">{errors.payment_date}</div>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Method <span className="required">*</span></label>
                            <select className="form-control" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                                {['Cash', 'UPI', 'BankTransfer', 'Cheque', 'Other'].map(m => <option key={m} value={m}>{m === 'BankTransfer' ? 'Bank Transfer' : m}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Amount ({'\u20B9'}) <span className="required">*</span></label>
                            <input type="number" className={`form-control ${errors.paid_amount ? 'is-invalid' : ''}`} min="0.01" step="0.01" value={form.paid_amount} onChange={e => setForm(f => ({ ...f, paid_amount: e.target.value }))} placeholder={remaining > 0 ? `Max \u20B9${remaining}` : '0'} />
                            {errors.paid_amount && <div className="form-error">{errors.paid_amount}</div>}
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Reference No</label>
                            <input className="form-control" value={form.reference_no} onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))} placeholder="UTR, Cheque No, etc." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Notes</label>
                            <input className="form-control" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Payment notes" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Payment Proof</label>
                        <div {...getRootProps()} className="dropzone" style={{ padding: '12px 16px' }}>
                            <input {...getInputProps()} />
                            {proofFile ? (
                                <div className="dropzone-file"><span>{proofFile.name}</span><button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setProofFile(null); }}>&times;</button></div>
                            ) : <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Drop proof file or click to browse</div>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <button className="btn btn-secondary" onClick={() => setShowForm(false)} disabled={submitting}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                            {submitting ? <><span className="spinner-inline"></span> Recording...</> : 'Record Payment'}
                        </button>
                    </div>
                </div>
            )}

            <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                    <div className="card-title">Recent Payments</div>
                </div>
                {loading ? <div className="spinner-wrap"><div className="spinner"></div></div> :
                    payments.length === 0 ? (
                        <div className="empty-state"><div className="empty-title">No payments recorded</div></div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Date</th><th>Purchase</th><th>Method</th><th>Amount</th><th>Reference</th><th>Recorded By</th></tr></thead>
                                <tbody>
                                    {payments.map(p => (
                                        <tr key={p.id}>
                                            <td>{p.payment_date}</td>
                                            <td className="text-primary font-semibold" style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/purchases/${p.purchase_id}`}>{p.purchase_id?.slice(0, 8)}...</td>
                                            <td><span className="badge badge-draft">{p.payment_method === 'BankTransfer' ? 'Bank Transfer' : p.payment_method}</span></td>
                                            <td className="font-bold" style={{ color: 'var(--color-success)' }}>{'\u20B9'}{(p.paid_amount || 0).toLocaleString('en-IN')}</td>
                                            <td>{p.reference_no || '\u2014'}</td>
                                            <td>{p.created_by_name || '\u2014'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                }
            </div>
        </AppLayout>
    );
}
