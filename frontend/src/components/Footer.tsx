import React from 'react';
import { Github } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div>
          <span>&copy; {new Date().getFullYear()} PR Assistant. Powered by Google Gemini.</span>
        </div>
        <div className="footer-links">
          <a 
            href="https://github.com/DakshDashora/pr-assisstant" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="footer-link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Github size={14} /> Repository
          </a>
          <a href="#" className="footer-link">Documentation</a>
          <a href="#" className="footer-link">Support</a>
        </div>
      </div>
    </footer>
  );
};
