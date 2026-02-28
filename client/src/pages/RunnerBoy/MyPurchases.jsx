import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout';
import api from '../../api/client';
import { StatusBadge } from '../Dashboard';

function ConfirmationChip({ status }) {
    if (!status) return null;
    const map = {
        NOT_ACKNOWLEDGED: { bg: 'rgba(239,68,68,0.1)', color: '#dc2626', label: 'Pending' },
        SHOWN_TO_VENDOR: { bg: 'rgba(245,158,11,0.1)', color: '#d97706', label: 'Shown' },
        VENDOR_CONFIRMED: { bg: 'rgba(22,163,74,0.1)', color: '#16a34a', label: 'Confirmed' },
    };
    const s = map[status] || map.NOT_ACKNOWLEDGED;
    return <span className="badge" style={{ background: s.bg, color: s.color, fontWeight: 600, fontSize: 10 }}>{s.label}</span>;
}

export default function MyPurchases() {
    const navigate = useNavigate();
    const [purchases, setPurchases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [confirmFilter, setConfirmFilter] = useState('');

    const load = () => {
        const params = statusFilter ? `?status=${statusFilter}` : '';
        api.get(`/purchases${params}`).then(r => {
            let data = r.data;
            if (confirmFilter === 'PENDING') data = data.filter(p => p.acknowledgement_status === 'NOT_ACKNOWLEDGED');
            if (confirmFilter === 'SHOWN') data = data.filter(p => p.acknowledgement_status === 'SHOWN_TO_VENDOR');
            if (confirmFilter === 'CONFIRMED') data = data.filter(p => p.acknowledgement_status === 'VENDOR_CONFIRMED');
            setPurchases(data);
            setLoading(false);
        }).catch(() => setLoading(false));
    };
    useEffect(() => { setLoading(true); load(); }, [statusFilter, confirmFilter]);

    const pendingCount = purchases.filter(p => p.acknowledgement_status === 'NOT_ACKNOWLEDGED').length;

    return (
        <AppLayout pageTitle="My Purchases">
            <div className="page-header">
                <div>
                    <div className="page-header-title">My Purchases</div>
                    <div className="page-header-sub">Your purchase submissions and vendor confirmations</div>
                </div>
                {pendingCount > 0 && (
                    <div style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
                        {pendingCount} confirmation{pendingCount > 1 ? 's' : ''} pending
                    </div>
                )}
            </div>

            <div className="filter-bar" style={{ display: 'flex', gap: 8 }}>
                <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ maxWidth: 200 }}>
                    <option value="">All Status</option>
                    {['INVOICE_SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAID', 'PARTIALLY_PAID'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="form-control" value={confirmFilter} onChange={e => setConfirmFilter(e.target.value)} style={{ maxWidth: 200 }}>
                    <option value="">All Confirmations</option>
                    <option value="PENDING">Confirmation Pending</option>
                    <option value="SHOWN">Shown to Vendor</option>
                    <option value="CONFIRMED">Vendor Confirmed</option>
                </select>
            </div>

            <div className="card" style={{ padding: 0 }}>
                {loading ? <div className="spinner-wrap"><div className="spinner"></div></div> :
                    purchases.length === 0 ? (
                        <div className="empty-state"><div className="empty-title">No purchases found</div><div className="empty-text">Try adjusting the filters above.</div></div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Request No</th><th>Invoice No</th><th>Vendor</th><th>Date</th><th>Invoice {'\u20B9'}</th><th>Status</th><th>Confirmation</th></tr></thead>
                                <tbody>
                                    {purchases.map(p => (
                                        <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/purchases/${p.id}`)}>
                                            <td className="text-primary font-semibold">{p.request_no || '\u2014'}</td>
                                            <td className="font-semibold">{p.invoice_no || '\u2014'}</td>
                                            <td>{p.vendor_name || '\u2014'}</td>
                                            <td className="text-muted">{p.invoice_date || '\u2014'}</td>
                                            <td className="font-semibold">{'\u20B9'}{(p.total_invoice_amount || 0).toLocaleString('en-IN')}</td>
                                            <td><StatusBadge status={p.status} /></td>
                                            <td>{p.acknowledgement_status ? <ConfirmationChip status={p.acknowledgement_status} /> : <span className="text-muted">{'\u2014'}</span>}</td>
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
