import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_ITERATIONS,
  VaultRecord,
  base64ToArrayBuffer,
  bufferToBase64,
  decryptWithKey,
  deriveKey,
  encryptWithKey,
  generateSalt,
} from "@/lib/crypto";

export type VaultEntry = {
  id: string;
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type VaultPhase =
  | "initializing"
  | "setup"
  | "locked"
  | "unlocking"
  | "unlocked";

type VaultMetadata = {
  salt: string;
  iterations: number;
};

const STORAGE_KEY = "cipherguard.vault";

const parseRecord = (value: string | null): VaultRecord | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as VaultRecord;
  } catch (error) {
    console.error("Failed to parse vault record", error);
    return null;
  }
};

const safeUUID = () => {
  if (typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

export const useVault = () => {
  const [phase, setPhase] = useState<VaultPhase>("initializing");
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<VaultMetadata | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const keyRef = useRef<CryptoKey | null>(null);
  const metaRef = useRef<VaultMetadata | null>(null);

  const syncMetadata = useCallback((meta: VaultMetadata | null) => {
    metaRef.current = meta;
    setMetadata(meta);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = parseRecord(localStorage.getItem(STORAGE_KEY));

    if (!stored) {
      syncMetadata(null);
      setPhase("setup");
      return;
    }

    syncMetadata({ salt: stored.salt, iterations: stored.iterations });
    setLastUpdated(stored.lastUpdated);
    setPhase("locked");
  }, [syncMetadata]);

  const persistEntries = useCallback(
    async (nextEntries: VaultEntry[]) => {
      const currentKey = keyRef.current;
      const meta = metaRef.current;

      if (!currentKey || !meta) {
        throw new Error("Vault is locked");
      }

      const { data, iv } = await encryptWithKey(
        JSON.stringify({ entries: nextEntries }),
        currentKey,
      );

      const record: VaultRecord = {
        version: 1,
        iterations: meta.iterations,
        salt: meta.salt,
        data,
        iv,
        lastUpdated: Date.now(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      setEntries(nextEntries);
      setLastUpdated(record.lastUpdated);
    },
    [],
  );

  const initializeVault = useCallback(
    async (password: string) => {
      setError(null);
      setPhase("unlocking");

      try {
        const saltBuffer = generateSalt();
        const iterations = DEFAULT_ITERATIONS;
        const cryptoKey = await deriveKey(password, saltBuffer, iterations);

        const { data, iv } = await encryptWithKey(
          JSON.stringify({ entries: [] }),
          cryptoKey,
        );

        const saltString = bufferToBase64(saltBuffer);
        const record: VaultRecord = {
          version: 1,
          iterations,
          salt: saltString,
          data,
          iv,
          lastUpdated: Date.now(),
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
        keyRef.current = cryptoKey;
        syncMetadata({ salt: saltString, iterations });
        setEntries([]);
        setLastUpdated(record.lastUpdated);
        setPhase("unlocked");
      } catch (err) {
        console.error("Failed to initialize vault", err);
        setError("Unable to initialize vault. Please try again.");
        setPhase("setup");
        throw err;
      }
    },
    [syncMetadata],
  );

  const unlockVault = useCallback(
    async (password: string) => {
      setError(null);
      setPhase("unlocking");

      try {
        const record = parseRecord(localStorage.getItem(STORAGE_KEY));

        if (!record) {
          syncMetadata(null);
          setEntries([]);
          setPhase("setup");
          throw new Error("Vault not found");
        }

        const saltBuffer = base64ToArrayBuffer(record.salt);
        const cryptoKey = await deriveKey(
          password,
          saltBuffer,
          record.iterations,
        );
        const decrypted = await decryptWithKey(record.data, record.iv, cryptoKey);
        const payload = JSON.parse(decrypted) as { entries?: VaultEntry[] };

        keyRef.current = cryptoKey;
        syncMetadata({ salt: record.salt, iterations: record.iterations });
        setEntries(payload.entries ?? []);
        setLastUpdated(record.lastUpdated);
        setPhase("unlocked");
        return true;
      } catch (err) {
        console.error("Failed to unlock vault", err);
        setError("Invalid master password. Please try again.");
        setPhase("locked");
        return false;
      }
    },
    [syncMetadata],
  );

  const lockVault = useCallback(() => {
    keyRef.current = null;
    setEntries([]);
    setError(null);
    setPhase(metadata ? "locked" : "setup");
  }, [metadata]);

  const resetVault = useCallback(() => {
    keyRef.current = null;
    metaRef.current = null;
    syncMetadata(null);
    setEntries([]);
    setLastUpdated(null);
    setPhase("setup");
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, [syncMetadata]);

  const addEntry = useCallback(
    async (
      entry: Omit<VaultEntry, "id" | "createdAt" | "updatedAt"> & {
        id?: string;
      },
    ) => {
      const now = new Date().toISOString();
      const tags = entry.tags.map((tag) => tag.trim()).filter(Boolean);

      const nextEntry: VaultEntry = {
        id: entry.id ?? safeUUID(),
        title: entry.title.trim(),
        username: entry.username.trim(),
        password: entry.password,
        url: entry.url?.trim(),
        notes: entry.notes?.trim(),
        tags,
        createdAt: now,
        updatedAt: now,
      };

      await persistEntries([...entries, nextEntry]);
      return nextEntry;
    },
    [entries, persistEntries],
  );

  const updateEntry = useCallback(
    async (id: string, updates: Partial<VaultEntry>) => {
      const index = entries.findIndex((entry) => entry.id === id);
      if (index === -1) {
        throw new Error("Entry not found");
      }

      const now = new Date().toISOString();
      const current = entries[index];
      const nextEntries = [...entries];
      nextEntries[index] = {
        ...current,
        ...updates,
        title: updates.title?.trim() ?? current.title,
        username: updates.username?.trim() ?? current.username,
        url: updates.url?.trim() ?? current.url,
        notes: updates.notes?.trim() ?? current.notes,
        tags:
          updates.tags?.map((tag) => tag.trim()).filter(Boolean) ??
          current.tags,
        updatedAt: now,
      };

      await persistEntries(nextEntries);
      return nextEntries[index];
    },
    [entries, persistEntries],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      const nextEntries = entries.filter((entry) => entry.id !== id);
      await persistEntries(nextEntries);
      return nextEntries;
    },
    [entries, persistEntries],
  );

  const importEntries = useCallback(
    async (imported: VaultEntry[]) => {
      const sanitized = imported.map((entry) => ({
        ...entry,
        id: entry.id ?? safeUUID(),
        title: entry.title.trim(),
        username: entry.username.trim(),
        url: entry.url?.trim(),
        notes: entry.notes?.trim(),
        tags: entry.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [],
        createdAt: entry.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      await persistEntries(sanitized);
      return sanitized;
    },
    [persistEntries],
  );

  const exportEntries = useCallback(() => {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        entries,
      },
      null,
      2,
    );
  }, [entries]);

  const stats = useMemo(() => {
    const byTag = new Map<string, number>();
    entries.forEach((entry) => {
      entry.tags.forEach((tag) => {
        byTag.set(tag, (byTag.get(tag) ?? 0) + 1);
      });
    });

    const weakPasswords = entries.filter(
      (entry) =>
        entry.password.length < 14 ||
        !/[0-9]/.test(entry.password) ||
        !/[^a-zA-Z0-9]/.test(entry.password),
    ).length;

    return {
      total: entries.length,
      tags: byTag,
      weakPasswords,
    };
  }, [entries]);

  return {
    phase,
    entries,
    error,
    metadata,
    lastUpdated,
    stats,
    initializeVault,
    unlockVault,
    lockVault,
    resetVault,
    addEntry,
    updateEntry,
    deleteEntry,
    importEntries,
    exportEntries,
  };
};
