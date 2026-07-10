import React from 'react';
import { Link } from 'react-router-dom';
import { Github } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div>
          <span>&copy; {new Date().getFullYear()} MendCode. Powered by AI.</span>
        </div>
        <div className="footer-links">
          <Link to="/terms" className="footer-link">Terms & Conditions</Link>
          <Link to="/privacy" className="footer-link">Privacy Policy</Link>
          <Link to="/security" className="footer-link">Security</Link>
          <a 
            href="https://github.com/DakshDashora/MendCode" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="footer-link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Github size={14} /> Repository
          </a>
        </div>
      </div>
    </footer>
  );
};
