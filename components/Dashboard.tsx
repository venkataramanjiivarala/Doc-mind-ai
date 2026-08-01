"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import Sidebar from "./Sidebar";
import FileUpload from "./FileUpload";
import ChatWindow from "./ChatWindow";

export type DocumentRow = {
  id: string;
  file_name: string;
  page_count: number | null;
  status: "processing" | "ready" | "error";
  created_at: string;
};

export default function Dashboard() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [selected, setSelected] = useState<DocumentRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadDocuments = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from("documents")
      .select("id, file_name, page_count, status, created_at")
      .order("created_at", { ascending: false });
    setDocuments((data as DocumentRow[]) || []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  function handleUploaded(doc: {
    documentId: string;
    fileName: string;
    pageCount: number | null;
    chunkCount: number;
  }) {
    const row: DocumentRow = {
      id: doc.documentId,
      file_name: doc.fileName,
      page_count: doc.pageCount,
      status: "ready",
      created_at: new Date().toISOString()
    };
    setDocuments((prev) => [row, ...prev]);
    setSelected(row);
    setSidebarOpen(false);
  }

  function handleDeleted(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    setSelected((prev) => (prev?.id === id ? null : prev));
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar
        documents={documents}
        selectedId={selected?.id ?? null}
        onSelect={(doc) => {
          setSelected(doc);
          setSidebarOpen(false);
        }}
        onNewUpload={() => {
          setSelected(null);
          setSidebarOpen(false);
        }}
        onDeleted={handleDeleted}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex items-center gap-3 border-b border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg border border-gray-200 p-2 text-gray-600 dark:border-gray-700 dark:text-gray-300"
            aria-label="Open menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {selected ? selected.file_name : "Chat with PDF"}
          </span>
        </div>

        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-y-auto p-4 md:p-8">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : selected ? (
            <div className="flex flex-1 flex-col">
              <div className="mb-3 hidden items-center justify-between md:flex">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Chatting with{" "}
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {selected.file_name}
                  </span>
                </p>
              </div>
              <ChatWindow doc={selected} key={selected.id} />
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-500 dark:from-brand-500/10 dark:to-brand-500/5">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                  <path d="M9 15l2 2 4-4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Upload a PDF to get started
              </h2>
              <p className="mt-2 max-w-sm text-gray-500 dark:text-gray-400">
                Ask questions and get answers grounded in your document, with sources drawn
                directly from the text.
              </p>
              <div className="mt-8 w-full">
                <FileUpload onUploaded={handleUploaded} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
