"use client";

import { useCallback, useRef, useState } from "react";

export type UploadedDoc = {
  documentId: string;
  fileName: string;
  pageCount: number | null;
  chunkCount: number;
};

export default function FileUpload({
  onUploaded
}: {
  onUploaded: (doc: UploadedDoc) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      onUploaded(data as UploadedDoc);
    } catch (err: any) {
      setError(err.message || "Something went wrong uploading the PDF.");
    } finally {
      setIsUploading(false);
    }
  }, [onUploaded]);

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`group cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all
          ${
            isDragging
              ? "scale-[1.01] border-brand-500 bg-brand-50 dark:bg-brand-500/10"
              : "border-gray-300 bg-white hover:border-brand-400 hover:bg-brand-50/40 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/5"
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand-500 border-t-transparent" />
            <p className="font-medium text-brand-600 dark:text-brand-400">
              Processing your PDF… this can take a moment.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400 transition-colors group-hover:bg-brand-100 group-hover:text-brand-500 dark:bg-gray-800 dark:group-hover:bg-brand-500/10">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">Drop your PDF here</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              or click to browse — max size depends on your server config
            </p>
          </div>
        )}
      </div>
      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
