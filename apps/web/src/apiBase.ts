interface BrowserLocation {
  hostname: string;
  origin: string;
  port: string;
  protocol: string;
}

export function resolveLogueApiBase(location: BrowserLocation, configuredBase?: string) {
  const configured = configuredBase?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (location.port === "5173") {
    return `${location.protocol}//${location.hostname}:8787`;
  }
  return location.origin;
}

export const logueApiBase = resolveLogueApiBase(
  window.location,
  import.meta.env.VITE_LOGUE_API_BASE,
);
