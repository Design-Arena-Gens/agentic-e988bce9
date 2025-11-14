'use client';

import { Fragment, useEffect, useMemo, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  ArrowPathIcon,
  ArrowUpOnSquareIcon,
  CheckIcon,
  ClipboardDocumentListIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  LockOpenIcon,
  PencilSquareIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useVault, type VaultEntry } from "@/hooks/useVault";
import {
  calculateStrength,
  defaultPasswordOptions,
  generatePassword,
  type PasswordOptions,
} from "@/lib/passwords";

const FIELD_CLASSES =
  "w-full rounded-xl border border-htb-border/60 bg-htb-surface-light/80 px-4 py-3 text-sm text-htb-text placeholder-htb-text-muted focus:border-htb-primary focus:outline-none focus:ring-2 focus:ring-htb-primary/40 transition";

type AlertBanner = {
  type: "success" | "error";
  message: string;
};

const createBlankForm = () => ({
  title: "",
  username: "",
  password: "",
  url: "",
  notes: "",
  tags: "",
});

export function VaultApp() {
  const {
    phase,
    entries,
    error,
    metadata,
    lastUpdated,
    stats,
    initializeVault,
    unlockVault,
    lockVault,
    addEntry,
    updateEntry,
    deleteEntry,
    exportEntries,
  } = useVault();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VaultEntry | null>(null);
  const [working, setWorking] = useState(false);
  const [alert, setAlert] = useState<AlertBanner | null>(null);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch =
        !searchTerm ||
        [entry.title, entry.username, entry.url, entry.notes]
          .filter(Boolean)
          .some((value) =>
            value!.toLowerCase().includes(searchTerm.toLowerCase()),
          ) ||
        entry.tags.some((tag) =>
          tag.toLowerCase().includes(searchTerm.toLowerCase()),
        );

      const matchesTag =
        !activeTag || entry.tags.map((tag) => tag.toLowerCase()).includes(activeTag.toLowerCase());

      return matchesSearch && matchesTag;
    });
  }, [entries, searchTerm, activeTag]);

  const allTags = useMemo(() => {
    const unique = new Set<string>();
    entries.forEach((entry) => entry.tags.forEach((tag) => unique.add(tag)));
    return Array.from(unique).sort();
  }, [entries]);

  const handleUnlock = async (password: string) => {
    setWorking(true);
    await unlockVault(password);
    setWorking(false);
  };

  const handleInitialize = async (password: string) => {
    setWorking(true);
    try {
      await initializeVault(password);
    } finally {
      setWorking(false);
    }
  };

  const handleSaveEntry = async (entry: VaultEntry | Omit<VaultEntry, "id" | "createdAt" | "updatedAt">) => {
    try {
      if ("id" in entry) {
        await updateEntry(entry.id, entry);
        setAlert({ type: "success", message: "Entry updated." });
      } else {
        await addEntry(entry);
        setAlert({ type: "success", message: "Entry added to vault." });
      }
    } catch {
      setAlert({ type: "error", message: "Unable to save entry." });
    } finally {
      setEntryModalOpen(false);
      setEditingEntry(null);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteEntry(id);
      setAlert({ type: "success", message: "Entry deleted." });
    } catch {
      setAlert({ type: "error", message: "Unable to delete entry." });
    }
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setAlert({ type: "success", message: `${label} copied to clipboard.` });
    } catch {
      setAlert({ type: "error", message: "Clipboard access denied." });
    }
  };

  const handleExport = () => {
    const contents = exportEntries();
    const blob = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cipherguard-export-${new Date().toISOString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setAlert({ type: "success", message: "Vault export generated." });
  };

  const dismissAlert = () => setAlert(null);

  const renderPhase = () => {
    switch (phase) {
      case "initializing":
        return <LoadingScreen />;
      case "setup":
        return (
          <AuthShell>
            <SetupScreen
              working={working}
              onInitialize={handleInitialize}
              error={error}
            />
          </AuthShell>
        );
      case "locked":
      case "unlocking":
        return (
          <AuthShell>
            <UnlockScreen
              working={phase === "unlocking" || working}
              error={error}
              onUnlock={handleUnlock}
              metadata={metadata}
            />
          </AuthShell>
        );
      case "unlocked":
        return (
          <VaultDashboard
            entries={filteredEntries}
            allEntries={entries}
            tags={allTags}
            stats={stats}
            searchTerm={searchTerm}
            activeTag={activeTag}
            lastUpdated={lastUpdated}
            onSearch={setSearchTerm}
            onTagSelect={setActiveTag}
            onAdd={() => {
              setEditingEntry(null);
              setEntryModalOpen(true);
            }}
            onEdit={(entry) => {
              setEditingEntry(entry);
              setEntryModalOpen(true);
            }}
            onDelete={handleDeleteEntry}
            onCopy={handleCopy}
            onLock={lockVault}
            onExport={handleExport}
          />
        );
      default:
        return <LoadingScreen />;
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-htb-background">
      <div className="absolute inset-0 -z-10 bg-grid-holo bg-cover bg-fixed bg-center" />
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_20%_20%,rgba(0,240,255,0.08),transparent_55%),radial-gradient(circle_at_80%_0%,rgba(124,252,0,0.16),transparent_50%)] opacity-90" />
      <div className="relative z-10 w-full max-w-6xl px-6 py-12 sm:px-12">
        {alert && (
          <div className="mb-6 rounded-xl border border-htb-border/70 bg-htb-surface-light/80 px-4 py-3 text-sm text-htb-text shadow-glow backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {alert.type === "success" ? (
                  <CheckIcon className="h-5 w-5 text-htb-primary" />
                ) : (
                  <XMarkIcon className="h-5 w-5 text-red-400" />
                )}
                <span>{alert.message}</span>
              </div>
              <button
                onClick={dismissAlert}
                className="rounded-lg border border-transparent px-2 py-1 text-xs text-htb-text-muted transition hover:border-htb-border/60 hover:text-htb-text"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {renderPhase()}
      </div>
      <EntryModal
        open={entryModalOpen}
        initialEntry={editingEntry}
        onClose={() => {
          setEntryModalOpen(false);
          setEditingEntry(null);
        }}
        onSave={handleSaveEntry}
        onDelete={(id) => handleDeleteEntry(id)}
      />
    </div>
  );
}

// Screens

const LoadingScreen = () => (
  <div className="flex h-[60vh] flex-col items-center justify-center gap-6 rounded-3xl border border-htb-border/60 bg-htb-surface/70 p-16 shadow-2xl shadow-htb-primary/20 backdrop-blur">
    <div className="relative flex h-24 w-24 items-center justify-center">
      <div className="h-24 w-24 animate-spin rounded-full border-2 border-htb-primary/20 border-t-htb-primary" />
      <LockClosedIcon className="absolute h-10 w-10 text-htb-primary" />
    </div>
    <p className="text-lg text-htb-text-muted">Initializing secure workspace…</p>
  </div>
);

const AuthShell = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-3xl border border-htb-border/60 bg-htb-surface/70 p-10 shadow-2xl shadow-htb-primary/20 backdrop-blur">
    <div className="mb-8">
      <span className="rounded-full border border-htb-border/80 bg-htb-surface-light/80 px-3 py-1 text-xs uppercase tracking-widest text-htb-text-muted">
        CipherGuard
      </span>
      <h1 className="mt-4 text-3xl font-semibold text-htb-text">
        Your Hack The Box Inspired Vault
      </h1>
      <p className="mt-3 text-sm text-htb-text-muted">
        Military-grade client-side encryption, zero-knowledge architecture, and
        professional UI with the Hack The Box neon glow.
      </p>
    </div>
    {children}
  </div>
);

const SetupScreen = ({
  working,
  onInitialize,
  error,
}: {
  working: boolean;
  onInitialize: (password: string) => Promise<void>;
  error: string | null;
}) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const strength = useMemo(() => calculateStrength(password), [password]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    if (password !== confirm) {
      setLocalError("Passwords do not match.");
      return;
    }

    if (password.length < 14 || strength.score < 4) {
      setLocalError(
        "Choose a stronger master password (min 14 chars, mix of symbols).",
      );
      return;
    }

    await onInitialize(password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4">
        <label className="text-sm font-medium text-htb-text-muted">
          Create Master Password
          <input
            type="password"
            required
            minLength={14}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={`${FIELD_CLASSES} mt-2`}
            placeholder="Super-strong passphrase with symbols"
          />
        </label>
        <PasswordStrengthIndicator password={password} />
        <label className="text-sm font-medium text-htb-text-muted">
          Confirm Password
          <input
            type="password"
            required
            minLength={14}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className={`${FIELD_CLASSES} mt-2`}
            placeholder="Retype master password"
          />
        </label>
      </div>

      {(localError || error) && (
        <p className="text-sm text-red-400">{localError ?? error}</p>
      )}

      <button
        type="submit"
        disabled={working}
        className="flex w-full items-center justify-center gap-3 rounded-xl bg-htb-primary px-4 py-3 text-sm font-semibold text-htb-background transition hover:bg-htb-primary-dark disabled:cursor-not-allowed disabled:bg-htb-primary/40"
      >
        <LockClosedIcon className="h-5 w-5" />
        {working ? "Hardening vault…" : "Initialize Vault"}
      </button>
      <p className="text-xs leading-6 text-htb-text-muted">
        We derive a 256-bit AES key client-side using PBKDF2 (310k iterations)
        and never transmit your secrets anywhere.
      </p>
    </form>
  );
};

const UnlockScreen = ({
  working,
  error,
  onUnlock,
  metadata,
}: {
  working: boolean;
  error: string | null;
  onUnlock: (password: string) => Promise<void>;
  metadata: { salt: string; iterations: number } | null;
}) => {
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onUnlock(password);
    setPassword("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4">
        <label className="text-sm font-medium text-htb-text-muted">
          Master Password
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={`${FIELD_CLASSES} mt-2`}
            placeholder="Enter master password"
          />
        </label>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={working}
        className="flex w-full items-center justify-center gap-3 rounded-xl bg-htb-primary px-4 py-3 text-sm font-semibold text-htb-background transition hover:bg-htb-primary-dark disabled:cursor-not-allowed disabled:bg-htb-primary/40"
      >
        <LockOpenIcon className="h-5 w-5" />
        {working ? "Decrypting vault…" : "Unlock Vault"}
      </button>
      {metadata && (
        <p className="text-xs text-htb-text-muted">
          PBKDF2 iterations: {metadata.iterations.toLocaleString()}
        </p>
      )}
    </form>
  );
};

const VaultDashboard = ({
  entries,
  allEntries,
  tags,
  stats,
  searchTerm,
  activeTag,
  lastUpdated,
  onSearch,
  onTagSelect,
  onAdd,
  onEdit,
  onDelete,
  onCopy,
  onLock,
  onExport,
}: {
  entries: VaultEntry[];
  allEntries: VaultEntry[];
  tags: string[];
  stats: { total: number; weakPasswords: number; tags: Map<string, number> };
  searchTerm: string;
  activeTag: string | null;
  lastUpdated: number | null;
  onSearch: (value: string) => void;
  onTagSelect: (tag: string | null) => void;
  onAdd: () => void;
  onEdit: (entry: VaultEntry) => void;
  onDelete: (id: string) => void;
  onCopy: (value: string, label: string) => void;
  onLock: () => void;
  onExport: () => void;
}) => {
  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-6 rounded-3xl border border-htb-border/60 bg-htb-surface/80 p-8 shadow-2xl shadow-htb-primary/15 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-htb-text">
              Vault Overview
            </h2>
            <p className="text-sm text-htb-text-muted">
              {lastUpdated
                ? `Last updated ${new Date(lastUpdated).toLocaleString()}`
                : "No credentials stored yet"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onExport}
              className="group flex items-center gap-2 rounded-xl border border-htb-primary/40 bg-transparent px-4 py-2 text-sm text-htb-primary transition hover:bg-htb-primary/10"
            >
              <ArrowUpOnSquareIcon className="h-5 w-5" />
              Export
            </button>
            <button
              onClick={onAdd}
              className="flex items-center gap-2 rounded-xl bg-htb-primary px-4 py-2 text-sm font-semibold text-htb-background transition hover:bg-htb-primary-dark shadow-glow"
            >
              <PlusIcon className="h-5 w-5" />
              New Credential
            </button>
            <button
              onClick={onLock}
              className="flex items-center gap-2 rounded-xl border border-htb-border/80 bg-htb-surface-light/60 px-4 py-2 text-sm text-htb-text-muted transition hover:text-htb-text hover:border-htb-border"
            >
              <LockClosedIcon className="h-5 w-5" />
              Lock
            </button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Stored Secrets"
            value={stats.total}
            description="Encrypted with AES-256 GCM"
          />
          <StatCard
            title="Weak Passwords"
            value={stats.weakPasswords}
            description="Consider rotating these"
            highlight={stats.weakPasswords > 0}
          />
          <StatCard
            title="Tagged Collections"
            value={stats.tags.size}
            description="Segment credentials by scope"
          />
        </div>
      </header>

      <section className="rounded-3xl border border-htb-border/60 bg-htb-surface/80 p-8 shadow-inner">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex flex-1 items-center">
            <ClipboardDocumentListIcon className="pointer-events-none absolute left-4 h-5 w-5 text-htb-text-muted" />
            <input
              className="w-full rounded-2xl border border-htb-border/60 bg-htb-surface-light/80 py-3 pl-12 pr-4 text-sm text-htb-text placeholder-htb-text-muted focus:border-htb-primary focus:outline-none focus:ring-2 focus:ring-htb-primary/40"
              placeholder="Search by title, URL, username, or tag…"
              value={searchTerm}
              onChange={(event) => onSearch(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <TagPill
              active={!activeTag}
              label="All"
              onClick={() => onTagSelect(null)}
            />
            {tags.map((tag) => (
              <TagPill
                key={tag}
                label={tag}
                active={activeTag === tag}
                onClick={() =>
                  onTagSelect(activeTag === tag ? null : tag)
                }
              />
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {entries.length === 0 ? (
            <EmptyState hasItems={allEntries.length > 0} onAdd={onAdd} />
          ) : (
            entries.map((entry) => (
              <VaultEntryCard
                key={entry.id}
                entry={entry}
                onEdit={() => onEdit(entry)}
                onDelete={() => onDelete(entry.id)}
                onCopy={onCopy}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
};

const StatCard = ({
  title,
  value,
  description,
  highlight,
}: {
  title: string;
  value: number;
  description: string;
  highlight?: boolean;
}) => (
  <div className="relative overflow-hidden rounded-2xl border border-htb-border/60 bg-htb-surface-light/80 p-6">
    <div className="absolute inset-0 opacity-20 blur-3xl" />
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-widest text-htb-text-muted">
          {title}
        </p>
        <p
          className={`mt-3 text-3xl font-semibold ${highlight ? "text-amber-300" : "text-htb-text"}`}
        >
          {value}
        </p>
        <p className="mt-1 text-xs text-htb-text-muted">{description}</p>
      </div>
      <div className="h-12 w-12 rounded-xl border border-htb-border/60 bg-htb-surface flex items-center justify-center">
        <ArrowPathIcon className="h-6 w-6 text-htb-primary" />
      </div>
    </div>
  </div>
);

const TagPill = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`rounded-full px-4 py-2 text-xs font-medium transition ${
      active
        ? "bg-htb-primary text-htb-background shadow-glow"
        : "border border-htb-border/80 bg-htb-surface-light/60 text-htb-text-muted hover:text-htb-text"
    }`}
  >
    #{label}
  </button>
);

const EmptyState = ({
  onAdd,
  hasItems,
}: {
  onAdd: () => void;
  hasItems: boolean;
}) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-htb-border/60 bg-htb-surface-light/40 px-10 py-16 text-center">
    <PlusIcon className="mb-4 h-10 w-10 rounded-full border border-htb-border/80 bg-htb-surface-light/60 p-2 text-htb-primary" />
    <h3 className="text-lg font-semibold text-htb-text">
      {hasItems ? "No entries match your filters" : "Add your first credential"}
    </h3>
    <p className="mt-2 text-sm text-htb-text-muted">
      Store credentials securely with client-side encryption and generate strong
      passwords instantly.
    </p>
    <button
      onClick={onAdd}
      className="mt-6 flex items-center gap-2 rounded-xl bg-htb-primary px-4 py-2 text-sm font-semibold text-htb-background transition hover:bg-htb-primary-dark shadow-glow"
    >
      <PlusIcon className="h-5 w-5" />
      Add Credential
    </button>
  </div>
);

const VaultEntryCard = ({
  entry,
  onEdit,
  onDelete,
  onCopy,
}: {
  entry: VaultEntry;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: (value: string, label: string) => void;
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const toggleVisibility = () => setShowPassword((prev) => !prev);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-htb-border/60 bg-htb-surface-light/80 p-6 transition hover:border-htb-primary/50 hover:shadow-glow">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-htb-primary/5 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-htb-text">
              {entry.title}
            </h3>
            {entry.url && (
              <a
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-htb-accent transition hover:text-htb-primary"
              >
                {entry.url}
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="rounded-xl border border-htb-border/80 bg-transparent p-2 text-htb-text-muted transition hover:border-htb-primary/40 hover:text-htb-primary"
            >
              <PencilSquareIcon className="h-5 w-5" />
            </button>
            <button
              onClick={onDelete}
              className="rounded-xl border border-htb-border/80 bg-transparent p-2 text-htb-text-muted transition hover:border-red-400/50 hover:text-red-400"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DataRow
            label="Username"
            value={entry.username}
            onCopy={() => onCopy(entry.username, "Username")}
          />
          <div>
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-htb-text-muted">
              <span>Password</span>
              <button
                onClick={toggleVisibility}
                className="rounded-lg border border-transparent px-2 py-1 text-[10px] text-htb-text-muted transition hover:border-htb-border/70 hover:text-htb-text"
              >
                {showPassword ? "Hide" : "Reveal"}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-htb-border/60 bg-htb-surface px-3 py-2 text-sm text-htb-text">
              <span className="truncate font-mono text-emerald-300">
                {showPassword ? entry.password : "••••••••••••••"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onCopy(entry.password, "Password")}
                  className="rounded-lg border border-transparent p-2 text-htb-text-muted transition hover:border-htb-border hover:text-htb-text"
                >
                  <ClipboardDocumentListIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={toggleVisibility}
                  className="rounded-lg border border-transparent p-2 text-htb-text-muted transition hover:border-htb-border hover:text-htb-text"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {entry.notes && (
          <div className="rounded-2xl border border-htb-border/60 bg-htb-surface px-4 py-3 text-sm text-htb-text-muted">
            {entry.notes}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-htb-text-muted">
          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-htb-primary/40 bg-htb-surface px-3 py-1 text-htb-primary"
            >
              #{tag}
            </span>
          ))}
          <span className="ml-auto text-[10px] uppercase tracking-widest text-htb-text-muted">
            Updated {new Date(entry.updatedAt).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

const DataRow = ({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) => (
  <div>
    <div className="flex items-center justify-between text-xs uppercase tracking-widest text-htb-text-muted">
      <span>{label}</span>
      <button
        onClick={onCopy}
        className="rounded-lg border border-transparent px-2 py-1 text-[10px] text-htb-text-muted transition hover:border-htb-border/70 hover:text-htb-text"
      >
        Copy
      </button>
    </div>
    <div className="mt-2 truncate rounded-xl border border-htb-border/60 bg-htb-surface px-3 py-2 text-sm text-htb-text">
      {value || "—"}
    </div>
  </div>
);

const PasswordStrengthIndicator = ({ password }: { password: string }) => {
  const strength = calculateStrength(password);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-htb-border/60 bg-htb-surface/70 px-4 py-3">
      <div className="flex items-center justify-between text-xs text-htb-text-muted">
        <span>Password Strength</span>
        <span className="text-htb-text">{strength.label}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-htb-surface-light/80">
        <div
          style={{ width: `${strength.percentage}%` }}
          className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
        />
      </div>
    </div>
  );
};

const EntryModal = ({
  open,
  initialEntry,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  initialEntry: VaultEntry | null;
  onClose: () => void;
  onSave: (
    entry: VaultEntry | Omit<VaultEntry, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) => {
  const [form, setForm] = useState(() => createBlankForm());
  const [passwordOptions, setPasswordOptions] = useState<PasswordOptions>(
    defaultPasswordOptions,
  );
  const [showGenerator, setShowGenerator] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialEntry) {
      setForm({
        title: initialEntry.title,
        username: initialEntry.username,
        password: initialEntry.password,
        url: initialEntry.url ?? "",
        notes: initialEntry.notes ?? "",
        tags: initialEntry.tags.join(", "),
      });
    } else {
      setForm(createBlankForm());
      setPasswordOptions(defaultPasswordOptions);
    }
  }, [initialEntry, open]);

  const resetForm = () => {
    setForm(createBlankForm());
    setPasswordOptions(defaultPasswordOptions);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const basePayload = {
      title: form.title,
      username: form.username,
      password: form.password,
      url: form.url || undefined,
      notes: form.notes || undefined,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    try {
      if (initialEntry) {
        await onSave({
          ...initialEntry,
          ...basePayload,
        });
      } else {
        await onSave(basePayload as Omit<
          VaultEntry,
          "id" | "createdAt" | "updatedAt"
        >);
      }
    } finally {
      setSaving(false);
      resetForm();
    }
  };

  const handleGenerate = () => {
    const password = generatePassword(passwordOptions);
    setForm((prev) => ({ ...prev, password }));
  };

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={handleClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center px-4 py-8 sm:items-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl overflow-hidden rounded-3xl border border-htb-border/80 bg-htb-surface shadow-2xl shadow-htb-primary/30">
                <div className="flex items-center justify-between border-b border-htb-border/60 px-6 py-4">
                  <div>
                    <Dialog.Title className="text-lg font-semibold text-htb-text">
                      {initialEntry ? "Edit Credential" : "New Credential"}
                    </Dialog.Title>
                    <Dialog.Description className="text-xs text-htb-text-muted">
                      All data encrypted using AES-256 GCM.
                    </Dialog.Description>
                  </div>
                  <button
                    onClick={handleClose}
                    className="rounded-xl border border-transparent p-2 text-htb-text-muted transition hover:border-htb-border/60 hover:text-htb-text"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="grid gap-4 px-6 py-5">
                    <label className="text-sm font-medium text-htb-text-muted">
                      Title
                      <input
                        required
                        value={form.title}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            title: event.target.value,
                          }))
                        }
                        className={`${FIELD_CLASSES} mt-2`}
                        placeholder="e.g. Hack The Box Portal"
                      />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="text-sm font-medium text-htb-text-muted">
                        Username
                        <input
                          required
                          value={form.username}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              username: event.target.value,
                            }))
                          }
                          className={`${FIELD_CLASSES} mt-2`}
                          placeholder="user@domain"
                        />
                      </label>
                      <label className="text-sm font-medium text-htb-text-muted">
                        URL
                        <input
                          value={form.url}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              url: event.target.value,
                            }))
                          }
                          className={`${FIELD_CLASSES} mt-2`}
                          placeholder="https://"
                        />
                      </label>
                    </div>
                    <label className="text-sm font-medium text-htb-text-muted">
                      Password
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          required
                          value={form.password}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              password: event.target.value,
                            }))
                          }
                          className={`${FIELD_CLASSES}`}
                          placeholder="Generated or custom password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowGenerator((prev) => !prev)}
                          className="rounded-xl border border-htb-border/70 bg-htb-surface-light/60 px-3 py-2 text-xs text-htb-text-muted transition hover:border-htb-primary/40 hover:text-htb-primary"
                        >
                          Generator
                        </button>
                      </div>
                    </label>
                    <PasswordStrengthIndicator password={form.password} />

                    <label className="text-sm font-medium text-htb-text-muted">
                      Tags
                      <input
                        value={form.tags}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            tags: event.target.value,
                          }))
                        }
                        className={`${FIELD_CLASSES} mt-2`}
                        placeholder="Comma separated tags (prod, vpn, db)"
                      />
                    </label>
                    <label className="text-sm font-medium text-htb-text-muted">
                      Secure Notes
                      <textarea
                        rows={3}
                        value={form.notes}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            notes: event.target.value,
                          }))
                        }
                        className={`${FIELD_CLASSES} mt-2`}
                        placeholder="Optional context, MFA backup codes, out-of-band notes…"
                      />
                    </label>

                    {showGenerator && (
                      <PasswordGenerator
                        options={passwordOptions}
                        onChange={setPasswordOptions}
                        onGenerate={handleGenerate}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-htb-border/60 bg-htb-surface-light/60 px-6 py-4">
                    {initialEntry && (
                      <button
                        type="button"
                        onClick={async () => {
                          await onDelete(initialEntry.id);
                          handleClose();
                        }}
                        className="flex items-center gap-2 rounded-xl border border-red-400/40 bg-transparent px-4 py-2 text-sm text-red-400 transition hover:bg-red-400/10"
                      >
                        <XMarkIcon className="h-5 w-5" />
                        Delete
                      </button>
                    )}
                    <div className="ml-auto flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-xl border border-htb-border/80 bg-transparent px-4 py-2 text-sm text-htb-text-muted transition hover:text-htb-text"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 rounded-xl bg-htb-primary px-4 py-2 text-sm font-semibold text-htb-background transition hover:bg-htb-primary-dark disabled:cursor-not-allowed disabled:bg-htb-primary/50"
                      >
                        <CheckIcon className="h-5 w-5" />
                        {saving
                          ? "Saving…"
                          : initialEntry
                            ? "Save Changes"
                            : "Add Credential"}
                      </button>
                    </div>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

const PasswordGenerator = ({
  options,
  onChange,
  onGenerate,
}: {
  options: PasswordOptions;
  onChange: (options: PasswordOptions) => void;
  onGenerate: () => void;
}) => {
  const toggle = (key: keyof PasswordOptions) => {
    onChange({ ...options, [key]: !options[key] });
  };

  return (
    <div className="rounded-2xl border border-htb-border/60 bg-htb-surface/80 p-4 text-sm text-htb-text">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-htb-text">
          Password Generator
        </h4>
        <button
          type="button"
          onClick={onGenerate}
          className="flex items-center gap-2 rounded-xl border border-htb-primary/40 px-3 py-1 text-xs font-semibold text-htb-primary transition hover:bg-htb-primary/10"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Generate
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="flex items-center justify-between text-xs text-htb-text-muted">
            Length
            <span className="text-htb-text">{options.length}</span>
          </label>
          <input
            type="range"
            min={12}
            max={64}
            value={options.length}
            onChange={(event) =>
              onChange({
                ...options,
                length: Number(event.target.value),
              })
            }
            className="mt-2 w-full cursor-pointer accent-htb-primary"
          />
        </div>
        <div className="grid gap-2 text-xs">
          <Checkbox
            label="Include lowercase"
            checked={options.lower}
            onChange={() => toggle("lower")}
          />
          <Checkbox
            label="Include uppercase"
            checked={options.upper}
            onChange={() => toggle("upper")}
          />
          <Checkbox
            label="Include digits"
            checked={options.digits}
            onChange={() => toggle("digits")}
          />
          <Checkbox
            label="Include symbols"
            checked={options.symbols}
            onChange={() => toggle("symbols")}
          />
        </div>
      </div>
      <p className="mt-3 text-xs text-htb-text-muted">
        Use generator for unique, high-entropy passwords per site.
      </p>
    </div>
  );
};

const Checkbox = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) => (
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-htb-border/80 bg-htb-surface text-htb-primary focus:ring-htb-primary"
    />
    <span>{label}</span>
  </label>
);
