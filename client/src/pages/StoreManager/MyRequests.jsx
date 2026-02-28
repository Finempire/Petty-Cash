import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout';
import api from '../../api/client';
import { StatusBadge } from '../Dashboard';

export default function MyRequests() {
    const navigate = useNavigate();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');

    const load = () => {
        const params = statusFilter ? `?status=${statusFilter}` : '';
        api.get(`/requests${params}`).then(r => { setRequests(r.data); setLoading(false); }).catch(() => setLoading(false));
    };
    useEffect(() => { setLoading(true); load(); }, [statusFilter]);

    return (
        <AppLayout pageTitle="Material Requests">
            <div className="page-header">
                <div>
                    <div className="page-header-title">Material Requests</div>
                    <div className="page-header-sub">Track all your purchase requests</div>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/requests/new')}>+ New Request</button>
            </div>

            <div className="filter-bar">
                <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="">All Status</option>
                    {['DRAFT', 'PENDING_PURCHASE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            <div className="card" style={{ padding: 0 }}>
                {loading ? <div className="spinner-wrap"><div className="spinner"></div></div> :
                    requests.length === 0 ? (
                        <div className="empty-state"><div className="empty-title">No requests found</div><div className="empty-text">Create a new material request to get started.</div></div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Request No</th><th>Buyer</th><th>Order / Style</th><th>Dept</th><th>Exp. Amount</th><th>Date</th><th>Status</th></tr></thead>
                                <tbody>
                                    {requests.map(r => (
                                        <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/requests/${r.id}`)}>
                                            <td className="font-semibold text-primary">{r.request_no}</td>
                                            <td>{r.buyer_name || '—'}</td>
                                            <td><div>{r.order_no || '—'}</div><div className="text-xs text-muted">{r.style || ''}</div></td>
                                            <td>{r.department || '—'}</td>
                                            <td className="font-semibold">₹{(r.total_expected_amount || 0).toLocaleString('en-IN')}</td>
                                            <td className="text-muted">{r.requested_date}</td>
                                            <td><StatusBadge status={r.status} /></td>
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
