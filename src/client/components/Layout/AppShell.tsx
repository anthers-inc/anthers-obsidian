// SPDX-License-Identifier: Apache-2.0
import { useState, useMemo, useCallback } from "react";
import { Outlet } from "react-router-dom";
import FileTree, { type SortMode } from "../Sidebar/FileTree";
import SidebarToolbar from "../Sidebar/SidebarToolbar";
import QuickSwitcher from "../Sidebar/QuickSwitcher";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";

export default function AppShell() {
  // First visit starts collapsed (readability); "1" persists an opened sidebar.
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      return localStorage.getItem("anthers-sidebar-open") === "1";
    } catch {
      return false;
    }
  });
  const setSidebarOpenPersisted = useCallback((next: boolean | ((v: boolean) => boolean)) => {
    setSidebarOpen((v) => {
      const value = typeof next === "function" ? next(v) : next;
      try {
        localStorage.setItem("anthers-sidebar-open", value ? "1" : "0");
      } catch {
        // Storage unavailable — the preference simply does not persist.
      }
      return value;
    });
  }, []);
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("name-asc");
  const [autoReveal, setAutoReveal] = useState(false);
  // expandGeneration: even = collapsed, odd = expanded. Incrementing toggles.
  const [expandGeneration, setExpandGeneration] = useState(0);
  const allExpanded = expandGeneration % 2 === 1;

  const handleToggleExpandAll = useCallback(() => {
    setExpandGeneration((g) => g + 1);
  }, []);

  const shortcuts = useMemo(
    () => [
      { key: "k", meta: true, handler: () => setQuickSwitcherOpen(true) },
      { key: "o", meta: true, handler: () => setQuickSwitcherOpen(true) },
      { key: "\\", meta: true, handler: () => setSidebarOpenPersisted((v) => !v) },
    ],
    [],
  );
  useKeyboardShortcuts(shortcuts);

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-title">
              <h2>The Anthers Wiki</h2>
              <a
                className="sidebar-powered"
                href="https://obsidian.md"
                target="_blank"
                rel="noopener noreferrer"
              >
                Powered by Obsidian
              </a>
            </div>
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpenPersisted(false)}
              title="Close sidebar"
            >
              ✕
            </button>
          </div>
          <div className="sidebar-actions">
            <button
              className="sidebar-action-btn"
              onClick={() => setQuickSwitcherOpen(true)}
              title="Search notes (Cmd+K)"
            >
              Search...
            </button>
          </div>
          <SidebarToolbar
            sortMode={sortMode}
            onSortChange={setSortMode}
            autoReveal={autoReveal}
            onAutoRevealToggle={() => setAutoReveal((v) => !v)}
            allExpanded={allExpanded}
            onToggleExpandAll={handleToggleExpandAll}
          />
          <nav className="sidebar-nav">
            <FileTree
              sortMode={sortMode}
              autoReveal={autoReveal}
              expandGeneration={expandGeneration}
            />
          </nav>
        </aside>
      )}
      <div className="content-area">
        {!sidebarOpen && (
          <button
            className="sidebar-open-btn"
            onClick={() => setSidebarOpenPersisted(true)}
            title="Open sidebar"
          >
            ☰
          </button>
        )}
        <main className="content">
          <Outlet />
        </main>
      </div>
      <QuickSwitcher
        isOpen={quickSwitcherOpen}
        onClose={() => setQuickSwitcherOpen(false)}
      />
    </div>
  );
}
