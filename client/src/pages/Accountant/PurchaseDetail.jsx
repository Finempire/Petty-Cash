import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../Dashboard';
import toast from 'react-hot-toast';

// Fetch file as blob with auth token
async function fetchFileBlob(filePath) {
    const res = await api.get(`/files/${filePath}`, { responseType: 'blob' });
    return res.data;
}

function FilePreview({ filePath, label, downloadName }) {
    if (!filePath) return null;
    const ext = filePath.split('.').pop()?.toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
    const canPreview = isImage || ext === 'pdf';
    const [showModal, setShowModal] = useState(false);
    const [blobUrl, setBlobUrl] = useState(null);
    const [loading, setLoading] = useState(false);

    const openPreview = async () => {
        setLoading(true);
        try {
            const blob = await fetchFileBlob(filePath);
            const url = URL.createObjectURL(blob);
            setBlobUrl(url);
            setShowModal(true);
        } catch { toast.error('Failed to load file'); }
        finally { setLoading(false); }
    };

    const handleDownload = async () => {
        setLoading(true);
        try {
            const blob = await fetchFileBlob(filePath);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadName ? `${downloadName}.${ext}` : filePath.split('/').pop();
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch { toast.error('Failed to download file'); }
        finally { setLoading(false); }
    };

    const closeModal = () => {
        setShowModal(false);
        if (blobUrl) { URL.revokeObjectURL(blobUrl); setBlobUrl(null); }
    };

    return (
        <>
            <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="font-semibold" style={{ fontSize: 13 }}>{label}</span>
                    {canPreview && (
                        <button className="btn btn-secondary btn-sm" onClick={openPreview} disabled={loading}>
                            {loading ? 'Loading...' : 'Preview'}
                        </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={handleDownload} disabled={loading}>
                        {loading ? 'Loading...' : 'Download'}
                    </button>
                </div>
            </div>
            {showModal && blobUrl && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={closeModal}>
                    <div style={{ background: '#fff', borderRadius: 10, width: '90vw', maxWidth: 800, maxHeight: '90vh', overflow: 'auto', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                            <span className="font-semibold">{label}</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-secondary btn-sm" onClick={handleDownload}>Download</button>
                                <button className="btn btn-ghost btn-sm" onClick={closeModal} style={{ fontSize: 18, lineHeight: 1 }}>&times;</button>
                            </div>
                        </div>
                        <div style={{ padding: 16 }}>
                            {isImage && <img src={blobUrl} alt={label} style={{ width: '100%', borderRadius: 6 }} />}
                            {ext === 'pdf' && <iframe src={blobUrl} style={{ width: '100%', height: '70vh', border: 'none', borderRadius: 6 }} title={label} />}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function ConfirmationStatusBadge({ status }) {
    const styles = {
        NOT_ACKNOWLEDGED: { background: 'rgba(239,68,68,0.1)', color: '#dc2626', label: 'Pending' },
        SHOWN_TO_VENDOR: { background: 'rgba(245,158,11,0.1)', color: '#d97706', label: 'Shown to Vendor' },
        VENDOR_CONFIRMED: { background: 'rgba(22,163,74,0.1)', color: '#16a34a', label: 'Vendor Confirmed' },
    };
    const s = styles[status] || styles.NOT_ACKNOWLEDGED;
    return <span className="badge" style={{ background: s.background, color: s.color, fontWeight: 600, fontSize: 11 }}>{s.label}</span>;
}

function VendorConfirmationSection({ purchase, user, onUpdate }) {
    const isRunner = user?.role === 'RUNNER_BOY' && purchase.runner_boy_user_id === user?.id;
    const vc = purchase.vendorConfirmation;
    const hasPaidPayments = purchase.payments?.some(p => p.paid_amount > 0);
    const [remark, setRemark] = useState(vc?.runner_remark || '');
    const [vendorConfirmed, setVendorConfirmed] = useState(vc?.acknowledgement_status === 'VENDOR_CONFIRMED');
    const [saving, setSaving] = useState(false);

    if (!hasPaidPayments && !vc) return null;

    const handleSave = async (status) => {
        setSaving(true);
        try {
            await api.post(`/purchases/${purchase.id}/acknowledgement`, {
                acknowledgement_status: status,
                runner_remark: remark || null
            });
            toast.success(status === 'VENDOR_CONFIRMED' ? 'Vendor confirmation recorded' : 'Marked as shown to vendor');
            onUpdate();
        } catch (err) { toast.error(err.response?.data?.error || 'Failed to save'); }
        finally { setSaving(false); }
    };

    return (
        <div className="card mb-4" style={{ borderLeft: `3px solid ${vc?.acknowledgement_status === 'VENDOR_CONFIRMED' ? 'var(--color-success)' : vc?.acknowledgement_status === 'SHOWN_TO_VENDOR' ? '#d97706' : 'var(--color-danger)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>Vendor Confirmation</div>
                {vc && <ConfirmationStatusBadge status={vc.acknowledgement_status} />}
            </div>

            {/* Timestamps */}
            {vc && (vc.shown_to_vendor_at || vc.vendor_confirmed_at) && (
                <div className="detail-grid" style={{ marginBottom: 16 }}>
                    {vc.shown_to_vendor_at && (
                        <div className="detail-item">
                            <div className="detail-label">Shown to Vendor</div>
                            <div className="detail-value">{new Date(vc.shown_to_vendor_at).toLocaleString('en-IN')}</div>
                        </div>
                    )}
                    {vc.vendor_confirmed_at && (
                        <div className="detail-item">
                            <div className="detail-label">Vendor Confirmed</div>
                            <div className="detail-value">{new Date(vc.vendor_confirmed_at).toLocaleString('en-IN')}</div>
                        </div>
                    )}
                    {vc.runner_name && (
                        <div className="detail-item">
                            <div className="detail-label">Confirmed By</div>
                            <div className="detail-value">{vc.runner_name}</div>
                        </div>
                    )}
                    {vc.runner_remark && (
                        <div className="detail-item">
                            <div className="detail-label">Remark</div>
                            <div className="detail-value">{vc.runner_remark}</div>
                        </div>
                    )}
                </div>
            )}

            {/* Runner Boy action form */}
            {isRunner && vc?.acknowledgement_status !== 'VENDOR_CONFIRMED' && (
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
                    <div className="form-group" style={{ marginBottom: 10 }}>
                        <label className="form-label">Remark (optional)</label>
                        <input className="form-control" value={remark} onChange={e => setRemark(e.target.value)}
                            placeholder="Any notes about vendor confirmation" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {(!vc || vc.acknowledgement_status === 'NOT_ACKNOWLEDGED') && (
                            <button className="btn btn-primary btn-sm" onClick={() => handleSave('SHOWN_TO_VENDOR')} disabled={saving}>
                                {saving ? <span className="spinner-inline"></span> : null} Mark as Shown to Vendor
                            </button>
                        )}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                            <input type="checkbox" checked={vendorConfirmed} onChange={e => setVendorConfirmed(e.target.checked)} />
                            <span>Vendor Confirmed</span>
                        </label>
                        {vendorConfirmed && (
                            <button className="btn btn-success btn-sm" onClick={() => handleSave('VENDOR_CONFIRMED')} disabled={saving}>
                                {saving ? <span className="spinner-inline"></span> : null} Save Confirmation
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Read-only for non-runner roles */}
            {!isRunner && !vc && hasPaidPayments && (
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    Awaiting vendor confirmation from the runner boy.
                </div>
            )}
        </div>
    );
}

export default function PurchaseDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [purchase, setPurchase] = useState(null);
    const [loading, setLoading] = useState(true);
    const [comment, setComment] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [taxInvoiceFile, setTaxInvoiceFile] = useState(null);
    const [taxUploading, setTaxUploading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const load = () => {
        api.get(`/purchases/${id}`).then(r => { setPurchase(r.data); setLoading(false); }).catch(() => setLoading(false));
    };
    useEffect(() => { load(); }, [id]);

    const handleApprove = async () => {
        setActionLoading(true);
        try {
            await api.patch(`/purchases/${id}/approve`, { accountant_comment: comment });
            toast.success('Purchase approved');
            load();
        } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
        finally { setActionLoading(false); }
    };

    const handleReject = async () => {
        if (!comment) { toast.error('Please add a comment explaining the rejection'); return; }
        setActionLoading(true);
        try {
            await api.patch(`/purchases/${id}/reject`, { accountant_comment: comment });
            toast.success('Purchase rejected');
            load();
        } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
        finally { setActionLoading(false); }
    };

    if (loading) return <AppLayout pageTitle="Purchase Detail"><div className="spinner-wrap"><div className="spinner"></div></div></AppLayout>;
    if (!purchase) return <AppLayout pageTitle="Purchase Detail"><div className="empty-state"><div className="empty-title">Purchase not found</div></div></AppLayout>;

    const isAccountant = user?.role === 'ACCOUNTANT';
    const isRunner = user?.role === 'RUNNER_BOY' && purchase.runner_boy_user_id === user?.id;
    const canReview = isAccountant && ['INVOICE_SUBMITTED', 'UNDER_REVIEW'].includes(purchase.status);
    const canPay = isAccountant && ['APPROVED', 'PARTIALLY_PAID'].includes(purchase.status);
    const totalPaid = purchase.payments?.reduce((s, p) => s + (p.paid_amount || 0), 0) || 0;
    const outstanding = (purchase.total_invoice_amount || 0) - totalPaid;
    const isProvisional = purchase.invoice_type_submitted === 'PROVISIONAL';
    const needsTaxInvoice = isProvisional && !purchase.tax_invoice_path;
    const vendorDownloadName = (purchase.vendor_name || 'Vendor').replace(/[^a-zA-Z0-9]/g, '_');

    const handleTaxInvoiceUpload = async () => {
        if (!taxInvoiceFile) { toast.error('Select a file first'); return; }
        setTaxUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', taxInvoiceFile);
            await api.post(`/purchases/${id}/tax-invoice`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success('Tax Invoice uploaded successfully');
            setTaxInvoiceFile(null);
            load();
        } catch (err) { toast.error(err.response?.data?.error || 'Upload failed'); }
        finally { setTaxUploading(false); }
    };

    const handleDelete = async () => {
        if (!confirm(`Delete purchase ${purchase.invoice_no || ''}?\n\nThis will permanently remove all line items, payments, and vendor confirmations.\n\nThis action cannot be undone.`)) return;
        setDeleteLoading(true);
        try {
            await api.delete(`/purchases/${id}`);
            toast.success('Purchase deleted');
            navigate('/purchases-review');
        } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); setDeleteLoading(false); }
    };

    return (
        <AppLayout pageTitle={`Purchase \u2013 ${purchase.invoice_no || 'Details'}`}>
            <div className="page-header">
                <div>
                    <div className="page-header-title">Purchase #{purchase.invoice_no || '\u2014'}</div>
                    <div className="page-header-sub">
                        <StatusBadge status={purchase.status} />
                        <span style={{ marginLeft: 8 }}>Request: {purchase.request_no}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {canPay && (
                        <button className="btn btn-primary" onClick={() => navigate(`/payments?purchase_id=${id}`)}>
                            Record Payment
                        </button>
                    )}
                    {isAccountant && (
                        <button className="btn btn-ghost" onClick={handleDelete} disabled={deleteLoading}
                            style={{ color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
                            {deleteLoading ? <><span className="spinner-inline"></span> Deleting...</> : 'Delete'}
                        </button>
                    )}
                </div>
            </div>

            {/* Purchase Info */}
            <div className="card mb-4">
                <div className="card-title mb-4">Purchase Information</div>
                <div className="detail-grid">
                    <div className="detail-item"><div className="detail-label">Invoice No</div><div className="detail-value">{purchase.invoice_no || '\u2014'}</div></div>
                    <div className="detail-item"><div className="detail-label">Invoice Date</div><div className="detail-value">{purchase.invoice_date || '\u2014'}</div></div>
                    <div className="detail-item"><div className="detail-label">Invoice Amount</div><div className="detail-value font-bold text-primary">{'\u20B9'}{(purchase.total_invoice_amount || 0).toLocaleString('en-IN')}</div></div>
                    <div className="detail-item"><div className="detail-label">Total Paid</div><div className="detail-value font-bold" style={{ color: 'var(--color-success)' }}>{'\u20B9'}{totalPaid.toLocaleString('en-IN')}</div></div>
                    <div className="detail-item"><div className="detail-label">Outstanding</div><div className="detail-value font-bold" style={{ color: outstanding > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{'\u20B9'}{outstanding.toLocaleString('en-IN')}</div></div>
                    <div className="detail-item"><div className="detail-label">Invoice Type</div>
                        <div className="detail-value">
                            <span className="badge" style={{ background: isProvisional ? 'rgba(245,158,11,0.12)' : 'rgba(22,163,74,0.12)', color: isProvisional ? '#d97706' : '#16a34a', fontWeight: 600, fontSize: 11 }}>
                                {isProvisional ? 'Provisional Invoice' : 'Tax Invoice'}
                            </span>
                        </div>
                    </div>
                    <div className="detail-item"><div className="detail-label">Runner Boy</div><div className="detail-value">{purchase.runner_name || '\u2014'}</div></div>
                    <div className="detail-item"><div className="detail-label">Buyer</div><div className="detail-value">{purchase.buyer_name || '\u2014'}</div></div>
                    <div className="detail-item"><div className="detail-label">Order</div><div className="detail-value">{purchase.order_no || '\u2014'} {purchase.style ? `(${purchase.style})` : ''}</div></div>
                </div>
                {purchase.notes && <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--color-bg-secondary)', borderRadius: 6, fontSize: 13 }}><strong>Notes:</strong> {purchase.notes}</div>}
                {purchase.accountant_comment && <div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(79,70,229,0.06)', borderRadius: 6, fontSize: 13, borderLeft: '3px solid var(--color-primary)' }}><strong>Accountant:</strong> {purchase.accountant_comment}</div>}
            </div>

            {/* Documents Card */}
            <div className="card mb-4">
                <div className="card-title mb-4">Documents</div>

                {/* 1. Initial Invoice */}
                <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--color-bg-secondary)', borderRadius: 6 }}>
                    <div className="font-semibold" style={{ fontSize: 13, marginBottom: 4 }}>
                        {isProvisional ? 'Provisional Invoice / Slip' : 'Tax Invoice / Final Bill'}
                    </div>
                    <FilePreview filePath={purchase.invoice_file_path} label="View Document"
                        downloadName={`${vendorDownloadName}_${isProvisional ? 'ProvisionalInvoice' : 'TaxInvoice'}_${purchase.invoice_no || 'NA'}`} />
                </div>

                {/* 2. Payment Proofs */}
                {purchase.payments?.filter(p => p.payment_proof_file_path).length > 0 && (
                    <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--color-bg-secondary)', borderRadius: 6 }}>
                        <div className="font-semibold" style={{ fontSize: 13, marginBottom: 4 }}>Payment Proof(s)</div>
                        {purchase.payments.filter(p => p.payment_proof_file_path).map(p => (
                            <FilePreview key={p.id} filePath={p.payment_proof_file_path}
                                label={`${p.payment_date} \u2013 \u20B9${(p.paid_amount || 0).toLocaleString('en-IN')} (${p.payment_method})`}
                                downloadName={`${vendorDownloadName}_PaymentProof_${p.payment_date}`} />
                        ))}
                    </div>
                )}

                {/* 3. Tax Invoice (if purchase started with provisional) */}
                {isProvisional && (
                    <div style={{ marginBottom: 8, padding: '10px 14px', background: purchase.tax_invoice_path ? 'rgba(22,163,74,0.06)' : 'rgba(245,158,11,0.06)', borderRadius: 6, border: `1px solid ${purchase.tax_invoice_path ? 'rgba(22,163,74,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                        <div className="font-semibold" style={{ fontSize: 13, marginBottom: 4 }}>
                            Final Tax Invoice / GST Bill
                            {purchase.tax_invoice_path
                                ? <span className="badge" style={{ marginLeft: 8, background: 'rgba(22,163,74,0.12)', color: '#16a34a', fontWeight: 600, fontSize: 10 }}>Uploaded</span>
                                : <span className="badge" style={{ marginLeft: 8, background: 'rgba(245,158,11,0.12)', color: '#d97706', fontWeight: 600, fontSize: 10 }}>Pending</span>
                            }
                        </div>
                        {purchase.tax_invoice_path ? (
                            <FilePreview filePath={purchase.tax_invoice_path} label="View Tax Invoice"
                                downloadName={`${vendorDownloadName}_TaxInvoice_${purchase.invoice_no || 'NA'}`} />
                        ) : isRunner ? (
                            <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>Upload the final Tax Invoice / GST bill received from the vendor</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input type="file" accept="image/*,.pdf" onChange={e => setTaxInvoiceFile(e.target.files[0] || null)} style={{ fontSize: 12 }} />
                                    <button className="btn btn-primary btn-sm" onClick={handleTaxInvoiceUpload} disabled={!taxInvoiceFile || taxUploading}>
                                        {taxUploading ? <><span className="spinner-inline"></span> Uploading...</> : 'Upload Tax Invoice'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>Awaiting final Tax Invoice upload from the Runner Boy</div>
                        )}
                    </div>
                )}
            </div>

            {/* Vendor Details */}
            <div className="card mb-4">
                <div className="card-title mb-4">Vendor Details</div>
                <div className="detail-grid">
                    <div className="detail-item"><div className="detail-label">Vendor Name</div><div className="detail-value font-semibold">{purchase.vendor_name || '\u2014'}</div></div>
                    <div className="detail-item"><div className="detail-label">Contact Person</div><div className="detail-value">{purchase.vendor_contact_person || '\u2014'}</div></div>
                    <div className="detail-item"><div className="detail-label">Phone</div><div className="detail-value">{purchase.vendor_phone ? <a href={`tel:${purchase.vendor_phone}`}>{purchase.vendor_phone}</a> : '\u2014'}</div></div>
                    <div className="detail-item"><div className="detail-label">Email</div><div className="detail-value">{purchase.vendor_email ? <a href={`mailto:${purchase.vendor_email}`}>{purchase.vendor_email}</a> : '\u2014'}</div></div>
                    <div className="detail-item"><div className="detail-label">GSTIN</div><div className="detail-value" style={{ fontFamily: 'monospace' }}>{purchase.vendor_gstin || '\u2014'}</div></div>
                </div>
            </div>

            {/* Line Items */}
            <div className="card mb-4">
                <div className="card-title mb-4">Line Items</div>
                <div className="table-wrap">
                    <table>
                        <thead><tr><th>Material</th><th>Description</th><th>Qty</th><th>Expected {'\u20B9'}</th><th>Actual {'\u20B9'}</th><th>Amount {'\u20B9'}</th></tr></thead>
                        <tbody>
                            {purchase.lines?.map((l, i) => {
                                const reqLine = purchase.requestLines?.find(rl => rl.material_id === l.material_id);
                                const diff = reqLine ? (l.actual_rate || l.rate || 0) - (reqLine.expected_rate || 0) : 0;
                                return (
                                    <tr key={i}>
                                        <td className="font-semibold">{l.material_name || '\u2014'}</td>
                                        <td>{l.description || '\u2014'}</td>
                                        <td>{l.quantity}</td>
                                        <td className="text-muted">{reqLine ? `\u20B9${reqLine.expected_rate}` : '\u2014'}</td>
                                        <td className="font-semibold" style={{ color: diff > 0 ? 'var(--color-danger)' : diff < 0 ? 'var(--color-success)' : undefined }}>
                                            {'\u20B9'}{(l.actual_rate || l.rate || 0).toLocaleString('en-IN')}
                                            {diff !== 0 && <span className="text-xs"> ({diff > 0 ? '+' : ''}{diff.toFixed(2)})</span>}
                                        </td>
                                        <td className="font-semibold">{'\u20B9'}{((l.quantity || 0) * (l.actual_rate || l.rate || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Approve/Reject Panel */}
            {canReview && (
                <div className="card mb-4" style={{ borderLeft: '3px solid var(--color-primary)' }}>
                    <div className="card-title mb-4">Review Decision</div>
                    <div className="form-group">
                        <label className="form-label">Comment</label>
                        <textarea className="form-control" rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a review comment..." />
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                        <button className="btn btn-success" onClick={handleApprove} disabled={actionLoading}>
                            {actionLoading ? <span className="spinner-inline"></span> : null} Approve
                        </button>
                        <button className="btn btn-danger" onClick={handleReject} disabled={actionLoading}>
                            {actionLoading ? <span className="spinner-inline"></span> : null} Reject
                        </button>
                    </div>
                </div>
            )}

            {/* Payment History */}
            {purchase.payments && purchase.payments.length > 0 && (
                <div className="card mb-4">
                    <div className="card-title mb-4">Payment History ({purchase.payments.length})</div>
                    <div className="table-wrap">
                        <table>
                            <thead><tr><th>Date</th><th>Method</th><th>Amount {'\u20B9'}</th><th>Reference</th><th>Recorded By</th><th>Proof</th></tr></thead>
                            <tbody>
                                {purchase.payments.map(p => (
                                    <tr key={p.id}>
                                        <td>{p.payment_date}</td>
                                        <td><span className="badge badge-draft">{p.payment_method === 'BankTransfer' ? 'Bank Transfer' : p.payment_method}</span></td>
                                        <td className="font-bold" style={{ color: 'var(--color-success)' }}>{'\u20B9'}{(p.paid_amount || 0).toLocaleString('en-IN')}</td>
                                        <td>{p.reference_no || '\u2014'}</td>
                                        <td>{p.created_by_name || '\u2014'}</td>
                                        <td>
                                            {p.payment_proof_file_path ? (
                                                <button className="btn btn-ghost btn-sm text-primary font-semibold" style={{ fontSize: 12, padding: '2px 6px' }}
                                                    onClick={async () => {
                                                        try {
                                                            const blob = await fetchFileBlob(p.payment_proof_file_path);
                                                            const url = URL.createObjectURL(blob);
                                                            window.open(url, '_blank');
                                                        } catch { toast.error('Failed to load proof'); }
                                                    }}>View</button>
                                            ) : <span className="text-muted">{'\u2014'}</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Vendor Confirmation Section */}
            <VendorConfirmationSection purchase={purchase} user={user} onUpdate={load} />
        </AppLayout>
    );
}
