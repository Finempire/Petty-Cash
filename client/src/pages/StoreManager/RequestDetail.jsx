import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../Dashboard';
import toast from 'react-hot-toast';

export default function RequestDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [req, setReq] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = () => {
        api.get(`/requests/${id}`).then(r => { setReq(r.data); setLoading(false); }).catch(() => { setLoading(false); });
    };
    useEffect(() => { load(); }, [id]);

    const handleCancel = async () => {
        if (!confirm('Cancel this request?')) return;
        try {
            await api.patch(`/requests/${id}`, { status: 'CANCELLED' });
            toast.success('Request cancelled');
            load();
        } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    };

    if (loading) return <AppLayout pageTitle="Request Detail"><div className="spinner-wrap"><div className="spinner"></div></div></AppLayout>;
    if (!req) return <AppLayout pageTitle="Request Detail"><div className="empty-state"><div className="empty-title">Request not found</div></div></AppLayout>;

    const isOwner = user?.id === req.requested_by_user_id;
    const canEdit = isOwner && req.status === 'DRAFT';
    const canCancel = isOwner && ['DRAFT', 'PENDING_PURCHASE'].includes(req.status);

    return (
        <AppLayout pageTitle={`Request ${req.request_no}`}>
            <div className="page-header">
                <div>
                    <div className="page-header-title">{req.request_no}</div>
                    <div className="page-header-sub">
                        <StatusBadge status={req.status} />
                        <span style={{ marginLeft: 8 }}>by {req.requested_by_name}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {canEdit && <button className="btn btn-secondary" onClick={() => navigate(`/requests/${id}/edit`)}>Edit</button>}
                    {canCancel && <button className="btn btn-danger" onClick={handleCancel}>Cancel Request</button>}
                </div>
            </div>

            {/* Request Info */}
            <div className="card mb-4">
                <div className="card-title mb-4">Request Details</div>
                <div className="detail-grid">
                    <div className="detail-item"><div className="detail-label">Buyer</div><div className="detail-value">{req.buyer_name || '—'}</div></div>
                    <div className="detail-item"><div className="detail-label">Order</div><div className="detail-value">{req.order_no || '—'} {req.style ? `(${req.style})` : ''}</div></div>
                    <div className="detail-item"><div className="detail-label">Department</div><div className="detail-value">{req.department || '—'}</div></div>
                    <div className="detail-item"><div className="detail-label">Preferred Vendor</div><div className="detail-value">{req.preferred_vendor_name || 'Any'}</div></div>
                    <div className="detail-item"><div className="detail-label">Request Date</div><div className="detail-value">{req.requested_date}</div></div>
                    <div className="detail-item"><div className="detail-label">Expected Purchase Date</div><div className="detail-value">{req.expected_purchase_date || '—'}</div></div>
                </div>
                {req.notes && <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--color-bg-secondary)', borderRadius: 6, fontSize: 13, color: 'var(--color-text-muted)' }}><strong>Notes:</strong> {req.notes}</div>}
            </div>

            {/* Line Items */}
            <div className="card mb-4">
                <div className="card-title mb-4">Line Items ({req.lines?.length || 0})</div>
                <div className="table-wrap">
                    <table>
                        <thead><tr><th>Material</th><th>Description</th><th>Qty</th><th>Rate (₹)</th><th>Amount (₹)</th></tr></thead>
                        <tbody>
                            {req.lines?.map((l, i) => (
                                <tr key={i}>
                                    <td className="font-semibold">{l.material_name || '—'} <span className="text-xs text-muted">{l.unit_of_measure || ''}</span></td>
                                    <td>{l.description || '—'}</td>
                                    <td>{l.quantity}</td>
                                    <td>₹{(l.expected_rate || 0).toLocaleString('en-IN')}</td>
                                    <td className="font-semibold">₹{(l.expected_amount || 0).toLocaleString('en-IN')}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={4} className="text-right font-semibold">Total Expected:</td>
                                <td className="font-bold text-primary">₹{(req.lines?.reduce((s, l) => s + (l.expected_amount || 0), 0) || 0).toLocaleString('en-IN')}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Linked Purchases */}
            {req.purchases && req.purchases.length > 0 && (
                <div className="card mb-4">
                    <div className="card-title mb-4">Linked Purchases ({req.purchases.length})</div>
                    <div className="table-wrap">
                        <table>
                            <thead><tr><th>Invoice No</th><th>Vendor</th><th>Runner</th><th>Date</th><th>Invoice ₹</th><th>Status</th></tr></thead>
                            <tbody>
                                {req.purchases.map(p => (
                                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/purchases/${p.id}`)}>
                                        <td className="font-semibold text-primary">{p.invoice_no || '—'}</td>
                                        <td>{p.vendor_name || '—'}</td>
                                        <td>{p.runner_name || '—'}</td>
                                        <td>{p.invoice_date || '—'}</td>
                                        <td>₹{(p.total_invoice_amount || 0).toLocaleString('en-IN')}</td>
                                        <td><StatusBadge status={p.status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
