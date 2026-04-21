/**
 * Script para descargar municipios de Espana y generar src/data/municipalities.ts
 * Fuente: PopulateTools/ine-places (INE - Instituto Nacional de Estadistica)
 *
 * Uso: bun run scripts/generate-municipalities.ts
 */

import { writeFileSync } from "fs";
import { resolve } from "path";

type RawMunicipality = {
  name: string;
  province: string;
  lat: number;
  lng: number;
};

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseCSVLine(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cols.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

async function fetchMunicipalities(): Promise<RawMunicipality[]> {
  // CSV de PopulateTools/ine-places con 8.119 municipios
  // Columnas: location_id, province_id, location_name, slug, province_name,
  //           autonomous_region_name, lat (realmente lon), lon (realmente lat)
  const url =
    "https://raw.githubusercontent.com/PopulateTools/ine-places/master/lib/ine/places/data/places.csv";

  console.log("Descargando municipios desde PopulateTools/ine-places...");
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Error descargando datos: ${res.status}`);
  }

  const text = await res.text();
  const lines = text.split("\n");
  const municipalities: RawMunicipality[] = [];

  // Saltar header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    // CSV con campos entrecomillados: location_id,province_id,location_name,slug,province_name,autonomous_region_name,lat,lon
    // NOTA: las columnas lat/lon estan invertidas en el CSV original
    const cols = parseCSVLine(line);
    if (cols.length < 8) continue;

    // Coordenadas: lat y lon estan invertidas en el CSV
    const lng = parseFloat(cols[6] ?? "");
    const lat = parseFloat(cols[7] ?? "");

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    // Validar que es Espana: lat entre 27-44, lng entre -19 y 5
    if (lat < 27 || lat > 44 || lng < -19 || lng > 5) continue;

    const name = cols[2]?.trim();
    const province = cols[4]?.trim();

    if (!name || !province) continue;

    municipalities.push({ name, province, lat, lng });
  }

  return municipalities;
}

async function main() {
  const municipalities = await fetchMunicipalities();

  if (municipalities.length < 1000) {
    throw new Error(
      `Solo se obtuvieron ${municipalities.length} municipios, se esperaban al menos 8.000`,
    );
  }

  console.log(`Obtenidos ${municipalities.length} municipios`);

  // Ordenar por nombre
  municipalities.sort((a, b) => a.name.localeCompare(b.name, "es"));

  const entries = municipalities.map((m) => {
    const slug = slugify(m.name);
    const search = normalizeSearch(m.name);
    return `  { name: ${JSON.stringify(m.name)}, province: ${JSON.stringify(m.province)}, lat: ${m.lat}, lng: ${m.lng}, slug: ${JSON.stringify(slug)}, search: ${JSON.stringify(search)} },`;
  });

  const content = `// Generado automaticamente por scripts/generate-municipalities.ts
// No editar manualmente

export type Municipality = {
  name: string;
  province: string;
  lat: number;
  lng: number;
  slug: string;
  search: string;
};

export const municipalities: Municipality[] = [
${entries.join("\n")}
];
`;

  const outPath = resolve(process.cwd(), "src", "data", "municipalities.ts");
  writeFileSync(outPath, content, "utf-8");
  console.log(`Generado ${outPath} con ${municipalities.length} municipios`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
