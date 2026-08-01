"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import ThemeToggle from "./ThemeToggle";
import type { DocumentRow } from "./Dashboard";

function StatusDot({ status }: { status: DocumentRow["status"] }) {
  const color =
    status === "ready"
      ? "bg-emerald-500"
      : status === "error"
      ? "bg-red-500"
      : "bg-amber-400 animate-pulse";
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${color}`} />;
}

export default function Sidebar({
  documents,
  selectedId,
  onSelect,
  onNewUpload,
  onDeleted,
  isOpen,
  onClose
}: {
  documents: DocumentRow[];
  selectedId: string | null;
  onSelect: (doc: DocumentRow) => void;
  onNewUpload: () => void;
  onDeleted: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  async function handleDelete(e: React.MouseEvent, docId: string) {
    e.stopPropagation();
    if (!confirm("Delete this document and its chat history?")) return;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("documents").delete().eq("id", docId);
    if (!error) onDeleted(docId);
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm md:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed z-30 flex h-full w-72 flex-col border-r border-gray-200/80 bg-white transition-transform duration-200 dark:border-gray-800 dark:bg-gray-900 md:static md:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-sm">
              P
            </div>
            <h1 className="text-[15px] font-semibold text-gray-900 dark:text-white">
              Chat with <span className="text-brand-500">PDF</span>
            </h1>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-4 pb-4 pt-3">
          <button
            onClick={onNewUpload}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-600 active:bg-brand-700"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Upload
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            History
          </p>

          {documents.length === 0 && (
            <p className="px-2 py-4 text-sm leading-relaxed text-gray-400 dark:text-gray-500">
              No documents yet — upload a PDF to get started.
            </p>
          )}

          <ul className="space-y-0.5">
            {documents.map((doc) => (
              <li key={doc.id}>
                <button
                  onClick={() => onSelect(doc)}
                  className={`group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors
                    ${
                      selectedId === doc.id
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/70"
                    }`}
                >
                  {selectedId === doc.id && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand-500" />
                  )}
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="shrink-0 opacity-60"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{doc.file_name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                      <StatusDot status={doc.status} />
                      {doc.status === "processing"
                        ? "Processing…"
                        : doc.status === "error"
                        ? "Failed to process"
                        : new Date(doc.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric"
                          })}
                    </span>
                  </span>
                  <span
                    onClick={(e) => handleDelete(e, doc.id)}
                    className="shrink-0 rounded-lg p-1.5 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:text-gray-600 dark:hover:bg-red-500/10"
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between border-t border-gray-200/80 px-4 py-3 dark:border-gray-800">
          <p className="text-xs text-gray-400 dark:text-gray-500">Shared library · open access</p>
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}
