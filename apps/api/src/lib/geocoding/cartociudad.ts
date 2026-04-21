type GeocodeResult =
  | {
      ok: true;
      latitude: string;
      longitude: string;
      confidence: string;
      raw: unknown;
    }
  | {
      ok: false;
      confidence: "0.00";
      error: string;
    };

type CartociudadCandidate = {
  id: string;
  province: string;
  muni: string;
  address: string;
  lat: number;
  lng: number;
  portalNumber: number | null;
  type: string;
  state: number;
};

function formatDecimal(value: number, digits: number) {
  if (!Number.isFinite(value)) return null;
  return value.toFixed(digits);
}

export async function geocodeWithCartociudad(input: {
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
  ]
    .filter(Boolean)
    .map((p) => String(p).trim())
    .filter(Boolean);

  const query = parts.join(", ").trim();
  if (!query) {
    return { ok: false, confidence: "0.00", error: "Direccion vacia" };
  }

  const url = new URL(
    "https://www.cartociudad.es/geocoder/api/geocoder/candidatesJsonp",
  );
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "No se pudo conectar con Cartociudad";
    return { ok: false, confidence: "0.00", error: message };
  }

  if (!res.ok) {
    return {
      ok: false,
      confidence: "0.00",
      error: `Cartociudad respondio ${res.status}`,
    };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return {
      ok: false,
      confidence: "0.00",
      error: "Respuesta invalida de Cartociudad",
    };
  }

  if (!Array.isArray(data) || data.length === 0) {
    return {
      ok: false,
      confidence: "0.00",
      error: "No se encontraron coordenadas para esa direccion",
    };
  }

  const first = data[0] as CartociudadCandidate;
  const lat = Number(first.lat);
  const lng = Number(first.lng);

  const latitude = formatDecimal(lat, 8);
  const longitude = formatDecimal(lng, 8);

  if (!latitude || !longitude) {
    return {
      ok: false,
      confidence: "0.00",
      error: "Cartociudad no devolvio coordenadas validas",
    };
  }

  // Cartociudad no da score de confianza; asumimos 0.80 para resultados validos
  return {
    ok: true,
    latitude,
    longitude,
    confidence: "0.80",
    raw: first,
  };
}
