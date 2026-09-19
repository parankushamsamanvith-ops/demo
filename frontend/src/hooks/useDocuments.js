import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://127.0.0.1:8000/api/v1";

export function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/documents`);
      if (!res.ok) throw new Error("Failed to load documents");
      const data = await res.json();
      setDocuments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const uploadDoc = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Upload failed");
    }

    await fetchDocs();
    return res.json();
  };

  const removeDoc = async (docId) => {
    const res = await fetch(`${API_BASE}/documents/${docId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete document");
    await fetchDocs();
  };

  return { documents, loading, error, refresh: fetchDocs, uploadDoc, removeDoc };
}