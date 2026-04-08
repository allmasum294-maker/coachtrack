import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 640 }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal animate-scale-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth, width: '90%' }}>
        {title !== null && (
          <div className="modal-header">
            <h2 className="modal-title">{title}</h2>
            <button className="btn btn-ghost btn-icon" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        )}
        <div className="modal-body">
          {children}
        </div>
      </div>
      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: var(--space-4);
        }
        .modal {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: var(--radius-xl);
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
          display: flex;
          flex-direction: column;
          max-height: 90vh;
          overflow: hidden;
        }
        [data-theme='dark'] .modal {
          background: rgba(23, 23, 23, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .modal-header {
          padding: var(--space-5) var(--space-6);
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }
        [data-theme='dark'] .modal-header {
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .modal-title {
          font-size: var(--font-size-xl);
          font-weight: 700;
          margin: 0;
        }
        .modal-body {
          padding: var(--space-6);
          overflow-y: auto;
          flex-grow: 1;
        }
        .animate-scale-in {
          animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
