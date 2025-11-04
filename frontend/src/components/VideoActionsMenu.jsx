// frontend/src/components/VideoActionsMenu.jsx
import React, { useState, useRef, useEffect } from 'react';

/**
 * Minimal 3-dot menu.
 * props:
 *  - onDetails() : open details popover
 *  - onRename() : trigger rename flow
 *  - onToggleSensitivity() : toggle safe/flagged
 *  - onDelete()
 */
export default function VideoActionsMenu({ onDetails, onRename, onToggleSensitivity, onDelete, sensitivity }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef();

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  return (
    <div className="actions-menu-root" ref={rootRef}>
      <button
        className="icon-btn three-dots"
        aria-haspopup="true"
        aria-expanded={open}
        title="More actions"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="5" cy="12" r="1.8" fill="#374151"/>
          <circle cx="12" cy="12" r="1.8" fill="#374151"/>
          <circle cx="19" cy="12" r="1.8" fill="#374151"/>
        </svg>
      </button>

      {open && (
        <div className="actions-menu-popover" role="menu" onClick={(e)=>e.stopPropagation()}>
          <button role="menuitem" className="menu-item" onClick={() => { setOpen(false); onDetails?.(); }}>
            <span className="menu-icon">ℹ️</span> Details
          </button>

          <button role="menuitem" className="menu-item" onClick={() => { setOpen(false); onRename?.(); }}>
            <span className="menu-icon">✏️</span> Rename
          </button>

          <button role="menuitem" className="menu-item" onClick={() => { setOpen(false); onToggleSensitivity?.(); }}>
            <span className="menu-icon">{sensitivity === 'flagged' ? '🛡️' : '🚩'}</span>
            {sensitivity === 'flagged' ? 'Mark Safe' : 'Flag'}
          </button>

          <div className="menu-sep" />

          <button role="menuitem" className="menu-item danger" onClick={() => { setOpen(false); onDelete?.(); }}>
            <span className="menu-icon">🗑️</span> Delete
          </button>
        </div>
      )}
    </div>
  );
}