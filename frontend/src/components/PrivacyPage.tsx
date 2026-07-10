import React from 'react';
import { ShieldAlert } from 'lucide-react';

export const PrivacyPage: React.FC = () => {
  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', textAlign: 'left', lineHeight: '1.6' }}>
      <div className="glass-panel" style={{ padding: '40px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldAlert size={24} style={{ color: 'var(--accent)' }} /> Privacy Policy
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
          Last updated: July 8, 2026
        </p>

        <section style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '1.1rem', marginBottom: '10px', color: '#e6edf3' }}>1. Information We Collect</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            We collect your email address and username for identity management, and your securely encrypted GitHub access token to authorize automated repository cloning and PR generation operations.
          </p>
        </section>

        <section style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '1.1rem', marginBottom: '10px', color: '#e6edf3' }}>2. Data Encryption and Storage</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            All linked GitHub tokens are encrypted using **Fernet symmetric encryption (AES-128)** before being written to the PostgreSQL/SQLite database. Decryption keys are managed strictly in server environment settings and are never exposed to the frontend client.
          </p>
        </section>

        <section style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '1.1rem', marginBottom: '10px', color: '#e6edf3' }}>3. How We Use Repository Data</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            MendCode clones repository content locally onto backend workspace sandbox containers to perform root cause analysis and write diffs. This codebase code is discarded or cleaned periodically and is never shared, sold, or used to train public language models.
          </p>
        </section>
      </div>
    </div>
  );
};
