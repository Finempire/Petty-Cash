import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout';
import api from '../../api/client';
import { StatusBadge } from '../Dashboard';

export default function PurchasesReview() {
    const navigate = useNavigate();
    const [purchases, setPurchases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ status: '', vendor_id: '', from: '', to: '' });
    const [vendors, setVendors] = useState([]);

    useEffect(() => { api.get('/vendors').then(r => setVendors(r.data)); }, []);

    const load = () => {
        const params = new URLSearchParams();
        if (filters.status) params.set('status', filters.status);
        if (filters.vendor_id) params.set('vendor_id', filters.vendor_id);
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        api.get(`/purchases?${params.toString()}`).then(r => { setPurchases(r.data); setLoading(false); }).catch(() => setLoading(false));
    };
    useEffect(() => { setLoading(true); load(); }, [filters]);

    const totalInvoiced = purchases.reduce((s, p) => s + (p.total_invoice_amount || 0), 0);

    return (
        <AppLayout pageTitle="Purchases Review">
            <div className="page-header">
                <div>
                    <div className="page-header-title">All Purchases</div>
                    <div className="page-header-sub">{purchases.length} purchase{purchases.length !== 1 ? 's' : ''} · Total ₹{totalInvoiced.toLocaleString('en-IN')}</div>
                </div>
            </div>

            <div className="filter-bar">
                <select className="form-control" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
                    <option value="">All Status</option>
                    {['INVOICE_SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAID', 'PARTIALLY_PAID', 'PAID_TAX_INVOICE_PENDING', 'COMPLETED'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
                <select className="form-control" value={filters.vendor_id} onChange={e => setFilters(f => ({ ...f, vendor_id: e.target.value }))}>
                    <option value="">All Vendors</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <input type="date" className="form-control" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} placeholder="From" />
                <input type="date" className="form-control" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} placeholder="To" />
            </div>

            <div className="card" style={{ padding: 0 }}>
                {loading ? <div className="spinner-wrap"><div className="spinner"></div></div> :
                    purchases.length === 0 ? (
                        <div className="empty-state"><div className="empty-title">No purchases found</div></div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Request No</th><th>Invoice No</th><th>Vendor</th><th>Runner</th><th>Date</th><th>Invoice ₹</th><th>Status</th></tr></thead>
                                <tbody>
                                    {purchases.map(p => (
                                        <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/purchases/${p.id}`)}>
                                            <td className="text-primary font-semibold">{p.request_no || '—'}</td>
                                            <td className="font-semibold">{p.invoice_no || '—'}</td>
                                            <td>{p.vendor_name || '—'}</td>
                                            <td>{p.runner_name || '—'}</td>
                                            <td className="text-muted">{p.invoice_date || '—'}</td>
                                            <td className="font-semibold">₹{(p.total_invoice_amount || 0).toLocaleString('en-IN')}</td>
                                            <td><StatusBadge status={p.status} /></td>
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
