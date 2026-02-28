import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../layouts/AppLayout';
import api from '../api/client';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#4f46e5', '#16a34a', '#2563eb', '#7c3aed', '#dc2626'];

function StoreManagerDashboard() {
    const navigate = useNavigate();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/requests').then(r => { setRequests(r.data); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    const stat = (s) => requests.filter(r => r.status === s).length;

    return (
        <div>
            <div className="kpi-grid">
                {[
                    { label: 'Total Requests', value: requests.length, accent: '#2563eb' },
                    { label: 'Pending Purchase', value: stat('PENDING_PURCHASE'), accent: '#d97706' },
                    { label: 'In Progress', value: stat('IN_PROGRESS'), accent: '#4f46e5' },
                    { label: 'Completed', value: stat('COMPLETED'), accent: '#16a34a' },
                ].map(k => (
                    <div className="kpi-card" key={k.label} style={{ '--accent': k.accent }}>
                        <div className="kpi-label">{k.label}</div>
                        <div className="kpi-value">{k.value}</div>
                    </div>
                ))}
            </div>
            <div className="card">
                <div className="card-header">
                    <div><div className="card-title">Recent Requests</div></div>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/requests/new')}>New Request</button>
                </div>
                {loading ? <div className="spinner-wrap"><div className="spinner"></div></div> : (
                    requests.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-title">No requests yet</div>
                            <div className="empty-text">Create a material request to get started.</div>
                        </div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Request No</th><th>Buyer</th><th>Order</th><th>Date</th><th>Expected Amt.</th><th>Status</th></tr></thead>
                                <tbody>
                                    {requests.slice(0, 10).map(r => (
                                        <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/requests/${r.id}`)}>
                                            <td className="font-semibold text-primary">{r.request_no}</td>
                                            <td>{r.buyer_name || '\u2014'}</td>
                                            <td>{r.order_no || '\u2014'}</td>
                                            <td>{r.requested_date}</td>
                                            <td>\u20B9{(r.total_expected_amount || 0).toLocaleString('en-IN')}</td>
                                            <td><StatusBadge status={r.status} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}

function AccountantCeoDashboard() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/reports/dashboard').then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="spinner-wrap"><div className="spinner"></div></div>;
    if (!data) return null;

    return (
        <div>
            <div className="kpi-grid">
                {[
                    { label: 'Total Requests', value: data.totalRequests, accent: '#2563eb' },
                    { label: 'Pending Review', value: data.pendingPurchases, accent: '#d97706' },
                    { label: 'Awaiting Payment', value: data.approvedUnpaid, accent: '#7c3aed' },
                    { label: 'Total Paid', value: `\u20B9${(data.totalPaid || 0).toLocaleString('en-IN')}`, accent: '#16a34a' },
                    { label: 'Total Invoiced', value: `\u20B9${(data.totalInvoiced || 0).toLocaleString('en-IN')}`, accent: '#4f46e5' },
                ].map(k => (
                    <div className="kpi-card" key={k.label} style={{ '--accent': k.accent }}>
                        <div className="kpi-label">{k.label}</div>
                        <div className="kpi-value" style={{ fontSize: typeof k.value === 'string' ? 18 : 22 }}>{k.value}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="card">
                    <div className="card-title mb-3">Monthly Cash Outflow</div>
                    <div className="chart-wrap" style={{ height: 200 }}>
                        <ResponsiveContainer>
                            <BarChart data={data.monthlyTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `\u20B9${(v / 1000).toFixed(0)}k`} />
                                <Tooltip formatter={v => `\u20B9${v.toLocaleString('en-IN')}`} contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }} />
                                <Bar dataKey="total_paid" fill="#4f46e5" radius={[3, 3, 0, 0]} name="Amount Paid" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <div className="card-title mb-3">Purchase Status</div>
                    <div className="chart-wrap" style={{ height: 200 }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie data={data.statusBreakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={70} label={e => `${e.status} (${e.count})`} labelLine={{ stroke: '#94a3b8' }} style={{ fontSize: 10 }}>
                                    {data.statusBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-title mb-3">Top Vendors by Purchase Value</div>
                <div className="chart-wrap" style={{ height: 180 }}>
                    <ResponsiveContainer>
                        <BarChart data={data.topVendors} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `\u20B9${(v / 1000).toFixed(0)}k`} />
                            <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} width={100} />
                            <Tooltip formatter={v => `\u20B9${v.toLocaleString('en-IN')}`} contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', fontSize: 12 }} />
                            <Bar dataKey="total" fill="#16a34a" radius={[0, 3, 3, 0]} name="Total Purchased" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

export function StatusBadge({ status }) {
    const map = {
        DRAFT: 'badge-draft', PENDING_PURCHASE: 'badge-pending', IN_PROGRESS: 'badge-progress',
        COMPLETED: 'badge-completed', CANCELLED: 'badge-cancelled',
        INVOICE_SUBMITTED: 'badge-submitted', UNDER_REVIEW: 'badge-review',
        APPROVED: 'badge-approved', REJECTED: 'badge-rejected',
        PAID: 'badge-paid', PARTIALLY_PAID: 'badge-partial',
        PAID_TAX_INVOICE_PENDING: 'badge-pending',
    };
    const labels = {
        DRAFT: 'Draft', PENDING_PURCHASE: 'Pending', IN_PROGRESS: 'In Progress',
        COMPLETED: 'Completed', CANCELLED: 'Cancelled',
        INVOICE_SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under Review',
        APPROVED: 'Approved', REJECTED: 'Rejected',
        PAID: 'Paid', PARTIALLY_PAID: 'Partial',
        PAID_TAX_INVOICE_PENDING: 'Tax Invoice Pending',
    };
    return <span className={`badge ${map[status] || 'badge-draft'}`}>{labels[status] || status}</span>;
}

export default function Dashboard() {
    const { user } = useAuth();
    const isAcctCeo = ['ACCOUNTANT', 'CEO'].includes(user?.role);
    return (
        <AppLayout pageTitle="Dashboard">
            {user?.role === 'RUNNER_BOY' ? (
                <RunnerBoyDashboard />
            ) : isAcctCeo ? (
                <AccountantCeoDashboard />
            ) : (
                <StoreManagerDashboard />
            )}
        </AppLayout>
    );
}

function RunnerBoyDashboard() {
    const navigate = useNavigate();
    const [requests, setRequests] = useState([]);
    useEffect(() => {
        api.get('/requests?status=PENDING_PURCHASE').then(r => setRequests(r.data)).catch(() => { });
    }, []);
    return (
        <div>
            <div className="kpi-grid">
                <div className="kpi-card" style={{ '--accent': '#d97706' }}>
                    <div className="kpi-label">Pending Purchases</div>
                    <div className="kpi-value">{requests.length}</div>
                </div>
            </div>
            <div className="card">
                <div className="card-title mb-3">Pending Purchase Requests</div>
                {requests.length === 0 ? (
                    <div className="empty-state"><div className="empty-title">No pending requests</div><div className="empty-text">New purchase requests will appear here.</div></div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead><tr><th>Request No</th><th>Buyer</th><th>Order</th><th>Expected Amt.</th><th>Action</th></tr></thead>
                            <tbody>
                                {requests.map(r => (
                                    <tr key={r.id}>
                                        <td className="font-semibold text-primary">{r.request_no}</td>
                                        <td>{r.buyer_name || '\u2014'}</td>
                                        <td>{r.order_no || '\u2014'}</td>
                                        <td>\u20B9{(r.total_expected_amount || 0).toLocaleString('en-IN')}</td>
                                        <td><button className="btn btn-primary btn-sm" onClick={() => navigate(`/pending-requests/${r.id}/purchase`)}>Create Purchase</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
