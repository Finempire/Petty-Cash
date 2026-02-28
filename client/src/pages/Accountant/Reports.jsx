import { useState, useEffect } from 'react';
import AppLayout from '../../layouts/AppLayout';
import api from '../../api/client';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#4f46e5', '#16a34a', '#2563eb', '#7c3aed', '#dc2626', '#d97706', '#0891b2'];
const TABS = [
    { key: 'daily', label: 'Daily Summary' },
    { key: 'vendor', label: 'Vendor Summary' },
    { key: 'buyer', label: 'Buyer / Order' },
    { key: 'runner', label: 'Runner Performance' },
    { key: 'outstanding', label: 'Outstanding' },
];

export default function Reports() {
    const [activeTab, setActiveTab] = useState('daily');
    const [filters, setFilters] = useState({ from: '', to: '', vendor_id: '' });
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [vendors, setVendors] = useState([]);

    useEffect(() => { api.get('/vendors').then(r => setVendors(r.data)); }, []);

    const load = () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        if (filters.vendor_id) params.set('vendor_id', filters.vendor_id);

        const endpoints = {
            daily: '/reports/daily-summary',
            vendor: '/reports/vendor-summary',
            buyer: '/reports/buyer-order',
            runner: '/reports/runner-performance',
            outstanding: '/reports/outstanding',
        };
        api.get(`${endpoints[activeTab]}?${params.toString()}`)
            .then(r => { setData(r.data); setLoading(false); })
            .catch(() => setLoading(false));
    };
    useEffect(() => { load(); }, [activeTab, filters]);

    const exportReport = async () => {
        const params = new URLSearchParams();
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        if (filters.vendor_id) params.set('vendor_id', filters.vendor_id);
        try {
            const res = await api.get(`/reports/export/${activeTab}?${params.toString()}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `${activeTab}-report.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch { }
    };

    return (
        <AppLayout pageTitle="Reports">
            <div className="page-header">
                <div>
                    <div className="page-header-title">Reports & Analytics</div>
                    <div className="page-header-sub">Monitor petty cash flow and performance</div>
                </div>
                <button className="btn btn-secondary" onClick={exportReport}>Export Excel</button>
            </div>

            {/* Tabs */}
            <div className="tabs mb-4">
                {TABS.map(t => (
                    <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="filter-bar">
                <input type="date" className="form-control" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
                <input type="date" className="form-control" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
                {['vendor', 'outstanding'].includes(activeTab) && (
                    <select className="form-control" value={filters.vendor_id} onChange={e => setFilters(f => ({ ...f, vendor_id: e.target.value }))}>
                        <option value="">All Vendors</option>
                        {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                )}
            </div>

            {loading ? <div className="spinner-wrap"><div className="spinner"></div></div> : (
                <div>
                    {/* Chart Section */}
                    {activeTab === 'daily' && data.length > 0 && (
                        <div className="card mb-4">
                            <div className="card-title mb-4">Daily Cash Outflow Trend</div>
                            <div style={{ height: 280 }}>
                                <ResponsiveContainer>
                                    <LineChart data={data}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                        <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                                        <Tooltip formatter={v => `₹${Number(v).toLocaleString('en-IN')}`} contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }} />
                                        <Line type="monotone" dataKey="total_paid" stroke="#4f46e5" strokeWidth={2} dot={{ fill: '#4f46e5' }} name="Total Paid" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {activeTab === 'vendor' && data.length > 0 && (
                        <div className="card mb-4">
                            <div className="card-title mb-4">Vendor Purchase Distribution</div>
                            <div style={{ height: 280 }}>
                                <ResponsiveContainer>
                                    <BarChart data={data}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                        <XAxis dataKey="vendor_name" tick={{ fill: '#64748b', fontSize: 11 }} />
                                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                                        <Tooltip formatter={v => `₹${Number(v).toLocaleString('en-IN')}`} contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }} />
                                        <Bar dataKey="total_amount" fill="#16a34a" radius={[4, 4, 0, 0]} name="Total Amount" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {activeTab === 'runner' && data.length > 0 && (
                        <div className="card mb-4">
                            <div className="card-title mb-4">Runner Boy Performance</div>
                            <div style={{ height: 280 }}>
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie data={data} dataKey="total_amount" nameKey="runner_name" cx="50%" cy="50%" outerRadius={100} label={e => `${e.runner_name}: ₹${Number(e.total_amount).toLocaleString('en-IN')}`}>
                                            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={v => `₹${Number(v).toLocaleString('en-IN')}`} contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', fontSize: 12 }} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Data Table */}
                    <div className="card" style={{ padding: 0 }}>
                        {data.length === 0 ? (
                            <div className="empty-state"><div className="empty-title">No data found</div><div className="empty-text">Try adjusting the date filters.</div></div>
                        ) : (
                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            {Object.keys(data[0]).map(k => (
                                                <th key={k}>{k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.map((row, i) => (
                                            <tr key={i}>
                                                {Object.values(row).map((val, j) => (
                                                    <td key={j} className={typeof val === 'number' && val > 100 ? 'font-semibold' : ''}>
                                                        {typeof val === 'number' && val > 100 ? `₹${val.toLocaleString('en-IN')}` : String(val ?? '—')}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
