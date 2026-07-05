"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";

interface Field {
  key: string;
  label: string;
  placeholder: string;
  secret?: boolean;
}

const PLATFORM_FIELDS: Record<string, Field[]> = {
  meta: [
    { key: "accessToken", label: "Access token", placeholder: "Marketing API access token (ads_read)", secret: true },
    { key: "accountId", label: "Ad account ID", placeholder: "act_1234567890" },
  ],
  google: [
    { key: "developerToken", label: "Developer token", placeholder: "Google Ads API developer token", secret: true },
    { key: "clientId", label: "OAuth client ID", placeholder: "xxxx.apps.googleusercontent.com" },
    { key: "clientSecret", label: "OAuth client secret", placeholder: "GOCSPX-…", secret: true },
    { key: "refreshToken", label: "Refresh token", placeholder: "1//… (offline-access refresh token)", secret: true },
    { key: "customerId", label: "Customer ID", placeholder: "1234567890 (10 digits, no dashes)" },
    { key: "loginCustomerId", label: "Manager (MCC) ID — optional", placeholder: "leave blank unless auth runs through an MCC" },
  ],
  tiktok: [
    { key: "accessToken", label: "Access token", placeholder: "TikTok Marketing API access token", secret: true },
    { key: "advertiserId", label: "Advertiser ID", placeholder: "7001234567890123456" },
  ],
  taboola: [
    { key: "clientId", label: "Client ID", placeholder: "Backstage API client ID" },
    { key: "clientSecret", label: "Client secret", placeholder: "Backstage API client secret", secret: true },
    { key: "accountId", label: "Account ID", placeholder: "your-network-account-id" },
  ],
};

export function PlatformConnect({
  platform,
  label,
  connected,
}: {
  platform: string;
  label: string;
  connected: { accountName: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fields = PLATFORM_FIELDS[platform] ?? [];

  const requiredFilled = fields
    .filter((f) => !f.label.includes("optional"))
    .every((f) => (values[f.key] ?? "").trim().length > 0);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/connections/${platform}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Failed (${res.status})`);
        return;
      }
      setOpen(false);
      setValues({});
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    await fetch(`/api/connections/${platform}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  if (connected) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-pos/30 bg-pos/5 p-3">
        <Badge tone="live">live</Badge>
        <span className="text-[13px] font-medium">{connected.accountName}</span>
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
          className="min-h-9 cursor-pointer rounded-md bg-primary px-4 text-[13px] font-medium text-white transition hover:bg-primary-hover active:translate-y-px"
        >
          Connect {label} account
        </button>
      ) : (
        <div className="space-y-2 rounded-md border border-line bg-surface-2/50 p-3">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="mb-0.5 block text-[11.5px] text-ink-faint" htmlFor={`${platform}-${f.key}`}>
                {f.label}
              </label>
              <input
                id={`${platform}-${f.key}`}
                type={f.secret ? "password" : "text"}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="min-h-9 w-full rounded-md border border-line bg-surface px-3 text-[13px] placeholder:text-ink-faint focus:border-primary focus:outline-none"
              />
            </div>
          ))}
          {error && <p className="text-[12.5px] text-neg">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={connect}
              disabled={busy || !requiredFilled}
              className="min-h-9 cursor-pointer rounded-md bg-primary px-4 text-[13px] font-medium text-white transition hover:bg-primary-hover active:translate-y-px disabled:opacity-40"
            >
              {busy ? `Validating with ${label}…` : "Connect"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="min-h-9 cursor-pointer rounded-md border border-line bg-surface-2 px-3 text-[13px] text-ink-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
          <p className="text-[11.5px] leading-relaxed text-ink-faint">
            Validated against the {label} API, then stored only in <em>your</em> encrypted
            httpOnly cookie — never logged or saved server-side. Once connected, every
            module reads your real delivery for this platform.
          </p>
        </div>
      )}
    </div>
  );
}

export function ServiceKeysForm({ hasVisitorKeys }: { hasVisitorKeys: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [apifyToken, setApifyToken] = useState("");
  const [firecrawlKey, setFirecrawlKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/connections/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ anthropicKey, apifyToken, firecrawlKey }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Failed (${res.status})`);
        return;
      }
      setOpen(false);
      setAnthropicKey("");
      setApifyToken("");
      setFirecrawlKey("");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    await fetch("/api/connections/services", { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mb-5 rounded-md border border-line bg-surface-2/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[14px] font-semibold">Use your own service keys</span>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            Run the live AI + scraping features on your own Anthropic / Apify / Firecrawl
            quota. Keys are validated, then kept only in your encrypted cookie — they
            override the deployment&apos;s keys for your session.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasVisitorKeys && <Badge tone="live">your keys active</Badge>}
          {hasVisitorKeys ? (
            <button
              onClick={clear}
              disabled={busy}
              className="min-h-8 cursor-pointer rounded-md border border-line bg-surface-2 px-2.5 text-[12px] text-ink-muted hover:text-ink disabled:opacity-50"
            >
              Remove my keys
            </button>
          ) : (
            <button
              onClick={() => setOpen(!open)}
              className="min-h-9 cursor-pointer rounded-md bg-primary px-4 text-[13px] font-medium text-white transition hover:bg-primary-hover active:translate-y-px"
            >
              {open ? "Close" : "Add my keys"}
            </button>
          )}
        </div>
      </div>

      {open && !hasVisitorKeys && (
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input
            type="password"
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder="Anthropic API key (sk-ant-…)"
            aria-label="Anthropic API key"
            className="min-h-9 rounded-md border border-line bg-surface-2 px-3 text-[13px] placeholder:text-ink-faint focus:border-primary focus:outline-none"
          />
          <input
            type="password"
            value={apifyToken}
            onChange={(e) => setApifyToken(e.target.value)}
            placeholder="Apify token (apify_api_…)"
            aria-label="Apify token"
            className="min-h-9 rounded-md border border-line bg-surface-2 px-3 text-[13px] placeholder:text-ink-faint focus:border-primary focus:outline-none"
          />
          <input
            type="password"
            value={firecrawlKey}
            onChange={(e) => setFirecrawlKey(e.target.value)}
            placeholder="Firecrawl key (fc-…)"
            aria-label="Firecrawl key"
            className="min-h-9 rounded-md border border-line bg-surface-2 px-3 text-[13px] placeholder:text-ink-faint focus:border-primary focus:outline-none"
          />
          {error && <p className="text-[12.5px] text-neg md:col-span-3">{error}</p>}
          <div className="md:col-span-3">
            <button
              onClick={save}
              disabled={busy || (!anthropicKey && !apifyToken && !firecrawlKey)}
              className="min-h-9 cursor-pointer rounded-md bg-primary px-4 text-[13px] font-medium text-white transition hover:bg-primary-hover active:translate-y-px disabled:opacity-40"
            >
              {busy ? "Validating…" : "Validate & save"}
            </button>
            <span className="ml-2 text-[11.5px] text-ink-faint">
              Provide any subset — each key is validated against its API before saving.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
