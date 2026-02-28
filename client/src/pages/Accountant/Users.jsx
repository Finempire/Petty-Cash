import { useState, useEffect } from 'react';
import AppLayout from '../../layouts/AppLayout';
import api from '../../api/client';
import toast from 'react-hot-toast';

const ROLES = ['STORE_MANAGER', 'RUNNER_BOY', 'ACCOUNTANT', 'CEO'];
const roleLabels = { STORE_MANAGER: 'Store Manager', RUNNER_BOY: 'Runner Boy', ACCOUNTANT: 'Accountant', CEO: 'CEO' };
const roleColors = { STORE_MANAGER: '#2563eb', RUNNER_BOY: '#16a34a', ACCOUNTANT: '#4f46e5', CEO: '#7c3aed' };

export default function Users() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editUser, setEditUser] = useState(null);

    const [form, setForm] = useState({
        name: '', email: '', phone: '', role: 'STORE_MANAGER', department: '', password: '', status: 'ACTIVE'
    });

    const load = () => {
        api.get('/users').then(r => { setUsers(r.data); setLoading(false); }).catch(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    const startNew = () => {
        setEditUser(null);
        setForm({ name: '', email: '', phone: '', role: 'STORE_MANAGER', department: '', password: '', status: 'ACTIVE' });
        setShowForm(true);
    };

    const startEdit = (u) => {
        setEditUser(u);
        setForm({ name: u.name, email: u.email, phone: u.phone || '', role: u.role, department: u.department || '', password: '', status: u.status || 'ACTIVE' });
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!form.name || !form.email || !form.role) { toast.error('Name, email, and role are required'); return; }
        if (!editUser && !form.password) { toast.error('Password required for new user'); return; }
        try {
            if (editUser) {
                const payload = { name: form.name, phone: form.phone, role: form.role, department: form.department, status: form.status };
                await api.patch(`/users/${editUser.id}`, payload);
                toast.success('User updated');
            } else {
                await api.post('/users', form);
                toast.success('User created');
            }
            setShowForm(false);
            setEditUser(null);
            load();
        } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    };

    return (
        <AppLayout pageTitle="Users">
            <div className="page-header">
                <div>
                    <div className="page-header-title">User Management</div>
                    <div className="page-header-sub">{users.length} user{users.length !== 1 ? 's' : ''} registered</div>
                </div>
                <button className="btn btn-primary" onClick={startNew}>+ Add User</button>
            </div>

            {showForm && (
                <div className="card mb-4" style={{ borderLeft: '3px solid var(--color-primary)' }}>
                    <div className="card-title mb-4">{editUser ? 'Edit User' : 'New User'}</div>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">Full Name *</label><input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                        <div className="form-group"><label className="form-label">Email *</label><input type="email" className="form-control" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!!editUser} /></div>
                    </div>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                        <div className="form-group">
                            <label className="form-label">Role *</label>
                            <select className="form-control" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                                {ROLES.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">Department</label><input className="form-control" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} /></div>
                        {!editUser && <div className="form-group"><label className="form-label">Password *</label><input type="password" className="form-control" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>}
                        {editUser && (
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select className="form-control" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                                    <option value="ACTIVE">Active</option>
                                    <option value="INACTIVE">Inactive</option>
                                </select>
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
                        <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditUser(null); }}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave}>{editUser ? 'Update' : 'Create User'}</button>
                    </div>
                </div>
            )}

            <div className="card" style={{ padding: 0 }}>
                {loading ? <div className="spinner-wrap"><div className="spinner"></div></div> : (
                    <div className="table-wrap">
                        <table>
                            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Actions</th></tr></thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td className="font-semibold">{u.name}</td>
                                        <td className="text-muted">{u.email}</td>
                                        <td><span className="badge" style={{ background: `${roleColors[u.role]}22`, color: roleColors[u.role], border: `1px solid ${roleColors[u.role]}44` }}>{roleLabels[u.role]}</span></td>
                                        <td>{u.department || '—'}</td>
                                        <td><span className={`badge ${u.status === 'ACTIVE' ? 'badge-approved' : 'badge-cancelled'}`}>{u.status}</span></td>
                                        <td><button className="btn btn-ghost btn-sm" onClick={() => startEdit(u)}>Edit</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
