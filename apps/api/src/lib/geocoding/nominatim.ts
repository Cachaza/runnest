type GeocodeResult =
  | {
      ok: true;
      latitude: string;
      longitude: string;
      confidence: string; // 0.00 to 1.00
      raw: unknown;
    }
  | {
      ok: false;
      confidence: "0.00";
      error: string;
    };

let queue: Promise<void> = Promise.resolve();
let lastRequestAtMs = 0;

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function formatDecimal(value: number, digits: number) {
  if (!Number.isFinite(value)) return null;
  return value.toFixed(digits);
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export async function geocodeWithNominatim(input: {
  address?: string | null;
  streetNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  province?: string | null;
}): Promise<GeocodeResult> {
  const parts = [
    [input.address, input.streetNumber].filter(Boolean).join(" ").trim(),
    input.postalCode,
    input.city,
    input.province,
    "España",
  ]
    .filter(Boolean)
    .map((p) => String(p).trim())
    .filter(Boolean);

  const query = parts.join(", ").trim();
  if (!query) {
    return { ok: false, confidence: "0.00", error: "Dirección vacía" };
  }

  return enqueue(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, 1000 - (now - lastRequestAtMs));
    if (waitMs > 0) {
      await new Promise((r) => setTimeout(r, waitMs));
    }
    lastRequestAtMs = Date.now();

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("countrycodes", "es");

    const userAgent =
      process.env.NOMINATIM_USER_AGENT ??
      "AppRunners (dev) - configura NOMINATIM_USER_AGENT";

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Accept-Language": "es",
          "User-Agent": userAgent,
        },
        cache: "no-store",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo conectar con Nominatim";
      return {
        ok: false,
        confidence: "0.00",
        error: message,
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        confidence: "0.00",
        error: `Nominatim respondió ${res.status}`,
      };
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return {
        ok: false,
        confidence: "0.00",
        error: "Respuesta inválida de Nominatim",
      };
    }

    if (!Array.isArray(data) || data.length === 0) {
      return {
        ok: false,
        confidence: "0.00",
        error: "No se encontraron coordenadas para esa dirección",
      };
    }

    const first = data[0] as { lat?: string; lon?: string; importance?: number };
    const lat = Number(first?.lat);
    const lon = Number(first?.lon);

    const latitude = formatDecimal(lat, 8);
    const longitude = formatDecimal(lon, 8);
    if (!latitude || !longitude) {
      return {
        ok: false,
        confidence: "0.00",
        error: "Nominatim no devolvió latitud/longitud válidas",
      };
    }

    const importance = clamp01(Number(first?.importance));
    const confidence = formatDecimal(importance, 2) ?? "0.00";

    return {
      ok: true,
      latitude,
      longitude,
      confidence,
      raw: first,
    };
  });
}
