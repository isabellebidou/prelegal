"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import styles from "./AppHeader.module.css";

interface AppHeaderProps {
  onNewDocument: () => void;
  onMyDocuments: () => void;
  onSignIn: () => void;
}

/** Top bar: brand, document actions and the account menu. */
export default function AppHeader({ onNewDocument, onMyDocuments, onSignIn }: AppHeaderProps) {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the account menu on any click outside it.
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        <span className={styles.mark} aria-hidden="true" />
        Prelegal
      </Link>

      <nav className={styles.actions} aria-label="Documents">
        <button type="button" className={styles.action} onClick={onNewDocument}>
          New document
        </button>
        {user && (
          <button type="button" className={styles.action} onClick={onMyDocuments}>
            My documents
          </button>
        )}
      </nav>

      {user === null && (
        <button type="button" className={styles.signIn} onClick={onSignIn}>
          Sign in
        </button>
      )}
      {user && (
        <div className={styles.account} ref={menuRef}>
          <button
            type="button"
            className={styles.avatar}
            aria-label={`Account: ${user.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {user.name.trim().charAt(0).toUpperCase()}
          </button>
          {menuOpen && (
            <div className={styles.menu} role="menu">
              <p className={styles.who}>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </p>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  void signOut();
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
