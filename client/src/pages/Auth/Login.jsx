import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(form.email, form.password);
            toast.success('Signed in successfully');
            navigate('/');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">
                    <div className="auth-logo-icon">PC</div>
                    <div className="auth-title">PettyCash</div>
                    <div className="auth-subtitle">Textile Co. Internal Finance System</div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input
                            type="email" className="form-control" placeholder="you@textileco.com"
                            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            required autoFocus autoComplete="email"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password" className="form-control" placeholder="Enter password"
                            value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            required autoComplete="current-password"
                        />
                    </div>
                    <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
                        {loading ? <><span className="spinner-inline"></span> Signing in...</> : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
