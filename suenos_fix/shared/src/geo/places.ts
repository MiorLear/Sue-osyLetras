// Búsqueda de ubicaciones (autocompletado tipo Google Maps) usando una API
// gratuita y SIN API key: Photon (komoot), construida sobre OpenStreetMap.
// Hoy filtra a El Salvador; para sumar países en el futuro basta con editar
// GEO_CONFIG (lista de countryCodes + bounding box que sesga los resultados).

export interface GeoConfig {
  /** ISO 3166-1 alpha-2 en minúscula, p. ej. 'sv' */
  countryCodes: string[];
  /** [minLon, minLat, maxLon, maxLat] que sesga la búsqueda a la región */
  bbox: [number, number, number, number];
}

/** El Salvador. Para expandir a más países, agrega su code y amplía el bbox. */
export const GEO_CONFIG: GeoConfig = {
  countryCodes: ['sv'],
  bbox: [-90.13, 13.1, -87.68, 14.45],
};

const PHOTON_URL = 'https://photon.komoot.io/api/';

interface PhotonProps {
  name?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  countrycode?: string;
}

/** Une nombre + municipio + departamento en una etiqueta legible y sin repetidos. */
function buildLabel(p: PhotonProps): string {
  const parts = [p.name, p.city, p.county, p.state].filter(
    (v, i, arr): v is string => !!v && arr.indexOf(v) === i,
  );
  return parts.slice(0, 3).join(', ');
}

/**
 * Devuelve hasta `limit` sugerencias de ubicación para `query`, filtradas a los
 * países de GEO_CONFIG. Nunca lanza: ante cualquier error devuelve [].
 */
export async function searchPlaces(query: string, limit = 6): Promise<string[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const codes = GEO_CONFIG.countryCodes.map((c) => c.toLowerCase());
  // Photon solo admite lang default/de/en/fr; sin lang devuelve el nombre local
  // (en español para El Salvador), que es justo lo que queremos.
  const params = new URLSearchParams({
    q,
    limit: String(limit * 2), // pedimos de más porque luego filtramos por país
    bbox: GEO_CONFIG.bbox.join(','),
  });

  try {
    const res = await fetch(`${PHOTON_URL}?${params.toString()}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: { properties: PhotonProps }[] };
    const seen = new Set<string>();
    const out: string[] = [];
    for (const f of data.features ?? []) {
      const p = f.properties;
      if (p.countrycode && !codes.includes(p.countrycode.toLowerCase())) continue;
      const label = buildLabel(p);
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push(label);
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}
