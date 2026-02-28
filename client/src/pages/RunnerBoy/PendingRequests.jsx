import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout';
import api from '../../api/client';
import { StatusBadge } from '../Dashboard';

export default function PendingRequests() {
    const navigate = useNavigate();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/requests?status=PENDING_PURCHASE').then(r => { setRequests(r.data); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    return (
        <AppLayout pageTitle="Pending Requests">
            <div className="page-header">
                <div>
                    <div className="page-header-title">Pending Purchase Requests</div>
                    <div className="page-header-sub">Requests awaiting material purchase</div>
                </div>
            </div>

            <div className="card" style={{ padding: 0 }}>
                {loading ? <div className="spinner-wrap"><div className="spinner"></div></div> :
                    requests.length === 0 ? (
                        <div className="empty-state"><div className="empty-title">No pending requests</div><div className="empty-text">New purchase requests will appear here when submitted by Store Managers.</div></div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Request No</th><th>Buyer</th><th>Order / Style</th><th>Dept</th><th>Expected ₹</th><th>Date</th><th>Action</th></tr></thead>
                                <tbody>
                                    {requests.map(r => (
                                        <tr key={r.id}>
                                            <td className="font-semibold text-primary" style={{ cursor: 'pointer' }} onClick={() => navigate(`/requests/${r.id}`)}>{r.request_no}</td>
                                            <td>{r.buyer_name || '—'}</td>
                                            <td><div>{r.order_no || '—'}</div><div className="text-xs text-muted">{r.style || ''}</div></td>
                                            <td>{r.department || '—'}</td>
                                            <td className="font-semibold">₹{(r.total_expected_amount || 0).toLocaleString('en-IN')}</td>
                                            <td className="text-muted">{r.requested_date}</td>
                                            <td>
                                                <button className="btn btn-primary btn-sm" onClick={() => navigate(`/pending-requests/${r.id}/purchase`)}>
                                                    Create Purchase
                                                </button>
                                            </td>
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
