import React from 'react';
import { Lock } from 'lucide-react';

export const SecurityPage: React.FC = () => {
  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', textAlign: 'left', lineHeight: '1.6' }}>
      <div className="glass-panel" style={{ padding: '40px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Lock size={24} style={{ color: 'var(--accent)' }} /> Security Framework
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
          Last updated: July 8, 2026
        </p>

        <section style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '1.1rem', marginBottom: '10px', color: '#e6edf3' }}>1. Token Protection</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Credentials, access keys, and authorization grants are encrypted with a highly secure symmetric cryptographic algorithm at the database level. Decrypted keys only exist temporarily in execution thread memory.
          </p>
        </section>

        <section style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '1.1rem', marginBottom: '10px', color: '#e6edf3' }}>2. API Path Safety</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            We implement strict path traversal validation constraints on all file explorer APIs. Any attempts to escape isolated job workspace folders (e.g. using `..` or absolute paths) are immediately blocked with a `403 Forbidden` response.
          </p>
        </section>

        <section style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '1.1rem', marginBottom: '10px', color: '#e6edf3' }}>3. Secure Communication</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            All requests to backend services are protected with JSON Web Tokens (JWT) signed with a custom, secure hashing signature. TLS/HTTPS is enforced for all data transit in production environments.
          </p>
        </section>
      </div>
    </div>
  );
};
