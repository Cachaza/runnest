import { NextResponse } from "next/server";
import { municipalities } from "@/data/municipalities";

type LocationSuggestion = {
  id: string;
  label: string;
  subtitle: string | undefined;
  latitude: number;
  longitude: number;
};

const MAX_SUGGESTIONS = 6;
const MIN_QUERY_LENGTH = 2;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ suggestions: [] as LocationSuggestion[] });
  }

  const normalized = normalize(query);

  // Primero los que empiezan por el query, luego los que lo contienen
  const startsWith: LocationSuggestion[] = [];
  const includes: LocationSuggestion[] = [];

  for (const m of municipalities) {
    if (startsWith.length + includes.length >= MAX_SUGGESTIONS * 2) break;

    if (m.search.startsWith(normalized)) {
      startsWith.push({
        id: `muni-${m.slug}`,
        label: m.name,
        subtitle: m.province,
        latitude: m.lat,
        longitude: m.lng,
      });
    } else if (m.search.includes(normalized)) {
      includes.push({
        id: `muni-${m.slug}`,
        label: m.name,
        subtitle: m.province,
        latitude: m.lat,
        longitude: m.lng,
      });
    }
  }

  const suggestions = [...startsWith, ...includes].slice(0, MAX_SUGGESTIONS);

  return NextResponse.json(
    { suggestions },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    },
  );
}
