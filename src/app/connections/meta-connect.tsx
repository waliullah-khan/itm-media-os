"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";

export function MetaConnect({
  connected,
}: {
  connected: { accountName: string; accountId: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/connections/meta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessToken: token, accountId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Failed (${res.status})`);
        return;
      }
      setOpen(false);
      setToken("");
      setAccountId("");
      router.refresh(); // every page now reads the live adapter
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    await fetch("/api/connections/meta", { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  if (connected) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-pos/30 bg-pos/5 p-3">
        <Badge tone="live">live</Badge>
        <span className="text-[13px]">
          <span className="font-medium">{connected.accountName}</span>{" "}
          <span className="text-ink-faint">({connected.accountId})</span>
        </span>
        <button
          onClick={disconnect}
          disabled={busy}
          className="ml-auto min-h-8 cursor-pointer rounded-md border border-line bg-surface-2 px-2.5 text-[12px] text-ink-muted hover:text-ink disabled:opacity-50"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="min-h-9 cursor-pointer rounded-md bg-primary px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        >
          Connect Meta account
        </button>
      ) : (
        <div className="space-y-2 rounded-md border border-line bg-surface-2/50 p-3">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Marketing API access token"
            aria-label="Meta access token"
            className="min-h-9 w-full rounded-md border border-line bg-surface px-3 text-[13px] placeholder:text-ink-faint focus:border-primary focus:outline-none"
          />
          <input
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="Ad account ID (act_1234567890)"
            aria-label="Meta ad account ID"
            className="min-h-9 w-full rounded-md border border-line bg-surface px-3 text-[13px] placeholder:text-ink-faint focus:border-primary focus:outline-none"
          />
          {error && <p className="text-[12.5px] text-neg">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={connect}
              disabled={busy || token.length < 20 || accountId.length < 6}
              className="min-h-9 cursor-pointer rounded-md bg-primary px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Validating with Meta…" : "Connect"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="min-h-9 cursor-pointer rounded-md border border-line bg-surface-2 px-3 text-[13px] text-ink-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
          <p className="text-[11.5px] leading-relaxed text-ink-faint">
            Validated against the Graph API, then stored only in <em>your</em> encrypted
            httpOnly cookie — never logged or saved server-side. Token needs{" "}
            <code className="rounded bg-surface px-1">ads_read</code>. Once connected,
            every module (dashboard, analyst, automations, planner) reads your real
            delivery for Meta.
          </p>
        </div>
      )}
    </div>
  );
}
