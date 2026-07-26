import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div>
          <span>&copy; {new Date().getFullYear()} MendCode. Powered by AI.</span>
        </div>
        <div className="footer-links">
          <Link to="/how-it-works" className="footer-link">How It Works</Link>
          <Link to="/terms" className="footer-link">Terms &amp; Conditions</Link>
          <Link to="/privacy" className="footer-link">Privacy Policy</Link>
          <Link to="/security" className="footer-link">Security</Link>
        </div>
      </div>
    </footer>
  );
};
