import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
import { Search, Loader, MapPin, X } from "lucide-react";
import L from "leaflet";
import { toast } from "sonner";

// default marker icon fix (leaflet ko known issue)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// location marker ko lagi brand logo (pin + checkmark) wala custom marker
const brandPinIcon = L.divIcon({
  className: "brand-location-pin-wrap",
  html:
    '<div class="brand-location-pin">' +
    '<div class="brand-location-pin-circle"><img src="/logo.svg" alt="Location" /></div>' +
    "</div>",
  iconSize: [38, 48],
  iconAnchor: [19, 46],
  popupAnchor: [0, -40],
});

interface ISearchResult {
  lat: string;
  lon: string;
  display_name: string;
  title?: string;
  subtitle?: string;
}

interface IPhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    locality?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
}

interface IGeofenceMapProps {
  latitude: number;
  longitude: number;
  radius: number;
  editable?: boolean;
  onLocationChange?: (lat: number, lng: number) => void;
  onLocationSelect?: (result: { address: string; latitude: number; longitude: number }) => void;
}

// map click garda location update garne
function ClickHandler({ enabled, onLocationChange }: { enabled: boolean; onLocationChange?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (enabled && onLocationChange) {
        onLocationChange(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// lat/lng change bhaye map center pani garne
function Recenter({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude], map.getZoom());
  }, [latitude, longitude, map]);
  return null;
}

// location search box + map - office location marker + radius circle dekhaune
export default function GeofenceMap({
  latitude,
  longitude,
  radius,
  editable = false,
  onLocationChange,
  onLocationSelect,
}: IGeofenceMapProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ISearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  // search select garda map remarki centering + zoom reset garne (mount-trigger)
  const [mapReset, setMapReset] = useState(0);

  // debounce + stale-response guard - typing pachhi 1-2 sec ma afai results aunchan
  const debounceRef = useRef<number | null>(null);
  const searchSeqRef = useRef(0);

  // unmount huda pending debounce cancel garne
  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  // valid coordinates chha ki nahi (0,0 default ho bhane Kathmandu ma focus garne)
  const hasValidLocation = !(latitude === 0 && longitude === 0);
  const center = useMemo<[number, number]>(() => {
    if (hasValidLocation) return [latitude, longitude];
    return [27.7172, 85.324]; // Kathmandu default
  }, [latitude, longitude, hasValidLocation]);

  // Nepal ma fix gareko search: viewbox(Nepal bounds) + countrycodes=np + Photon fuzzy search
  const NEPAL_VIEWBOX = "80.0586,26.3473,88.2019,30.4490";

  const formatResultParts = (displayName: string): { title: string; subtitle: string } => {
    const parts = displayName
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const title = parts[0] || displayName;
    const subtitle = parts.slice(1).join(", ");
    return { title, subtitle };
  };

  // Multi-source location search (Photon fuzzy/autocomplete + OpenStreetMap Nominatim + Nepal fallback)
  const searchLocation = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const seq = ++searchSeqRef.current;
    setSearching(true);
    try {
      const biasLat = center[0] || 27.7172;
      const biasLon = center[1] || 85.324;

      // 1. Photon API (fuzzy/partial/local landmark & chowk search biased to current center & bounded to Nepal)
      const photonPromise = fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&lat=${biasLat}&lon=${biasLon}&bbox=${NEPAL_VIEWBOX}&limit=10`,
        { headers: { Accept: "application/json" } },
      )
        .then((r) => r.json() as Promise<{ features?: IPhotonFeature[] }>)
        .then((json) => {
          const items: ISearchResult[] = [];
          for (const f of json.features || []) {
            const coords = f.geometry?.coordinates;
            const p = f.properties;
            if (!coords || coords.length < 2 || !p) continue;
            if (p.countrycode && p.countrycode.toUpperCase() !== "NP") continue;
            const parts = [p.name, p.street, p.locality, p.district, p.city, p.county, p.state, p.country || "Nepal"]
              .map((x) => (x || "").trim())
              .filter(Boolean);
            // deduplicate consecutive identical parts
            const uniqueParts = parts.filter((val, idx, arr) => arr.findIndex((t) => t.toLowerCase() === val.toLowerCase()) === idx);
            if (uniqueParts.length === 0) continue;
            const display_name = uniqueParts.join(", ");
            const { title, subtitle } = formatResultParts(display_name);
            items.push({
              lat: String(coords[1]),
              lon: String(coords[0]),
              display_name,
              title,
              subtitle,
            });
          }
          return items;
        })
        .catch(() => [] as ISearchResult[]);

      // 2. Nominatim primary search across Nepal (without strict bounded=1 rejection when viewbox is used)
      const nominatimPromise = fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=10&countrycodes=np&viewbox=${NEPAL_VIEWBOX}&q=${encodeURIComponent(trimmed)}`,
        { headers: { Accept: "application/json" } },
      )
        .then((r) => r.json() as Promise<ISearchResult[]>)
        .then((list) =>
          (Array.isArray(list) ? list : []).map((item) => {
            const { title, subtitle } = formatResultParts(item.display_name);
            return { ...item, title, subtitle };
          }),
        )
        .catch(() => [] as ISearchResult[]);

      const [photonResults, nominatimResults] = await Promise.all([photonPromise, nominatimPromise]);
      if (seq !== searchSeqRef.current) return;

      let combined = [...nominatimResults, ...photonResults];

      // 3. Fallback: if user typed a multi-word or informal local query and got 0 results, retry with ", Nepal" or simplified tokens
      if (combined.length === 0) {
        const fallbackQuery = trimmed.toLowerCase().includes("nepal") ? trimmed.split(/[\s,]+/)[0] : `${trimmed}, Nepal`;
        if (fallbackQuery) {
          const fallbackRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&countrycodes=np&q=${encodeURIComponent(fallbackQuery)}`,
            { headers: { Accept: "application/json" } },
          )
            .then((r) => r.json() as Promise<ISearchResult[]>)
            .catch(() => [] as ISearchResult[]);
          if (seq !== searchSeqRef.current) return;
          combined = (Array.isArray(fallbackRes) ? fallbackRes : []).map((item) => {
            const { title, subtitle } = formatResultParts(item.display_name);
            return { ...item, title, subtitle };
          });
        }
      }

      // Deduplicate nearby results with same title
      const deduped: ISearchResult[] = [];
      for (const item of combined) {
        const latNum = Number(item.lat);
        const lonNum = Number(item.lon);
        if (Number.isNaN(latNum) || Number.isNaN(lonNum)) continue;
        const isDuplicate = deduped.some((existing) => {
          const dLat = Math.abs(Number(existing.lat) - latNum);
          const dLon = Math.abs(Number(existing.lon) - lonNum);
          const sameCoords = dLat < 0.0008 && dLon < 0.0008;
          const sameTitle = (existing.title || "").toLowerCase() === (item.title || "").toLowerCase();
          return sameCoords && sameTitle;
        });
        if (!isDuplicate) {
          deduped.push(item);
        }
      }

      setResults(deduped.slice(0, 12));
      setShowResults(true);
    } catch {
      if (seq === searchSeqRef.current) {
        toast.error("Location search failed. Please try again.");
      }
    } finally {
      if (seq === searchSeqRef.current) setSearching(false);
    }
  };

  const handleSelect = (r: ISearchResult) => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    // map lai search gareko place ma clear + zoom level ma dekhaun (remount garchhau)
    setMapReset((n) => n + 1);
    if (onLocationChange) onLocationChange(lat, lng);
    if (onLocationSelect) onLocationSelect({ address: r.display_name, latitude: lat, longitude: lng });
    setQuery(r.display_name);
    setShowResults(false);
  };

  return (
    <div>
      {editable && (
        <div className="relative mb-3 z-[1000]">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  const v = e.target.value;
                  setQuery(v);
                  if (debounceRef.current) {
                    window.clearTimeout(debounceRef.current);
                    debounceRef.current = null;
                  }
                  if (!v.trim()) {
                    setResults([]);
                    setShowResults(false);
                    return;
                  }
                  // typing pachhi 450ms ma afai smart search
                  debounceRef.current = window.setTimeout(() => {
                    debounceRef.current = null;
                    void searchLocation(v);
                  }, 450);
                }}
                onFocus={() => {
                  if (results.length > 0) setShowResults(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (debounceRef.current) {
                      window.clearTimeout(debounceRef.current);
                      debounceRef.current = null;
                    }
                    if (!searching) void searchLocation(query);
                  }
                }}
                placeholder="Search any area, chowk, landmark, or city (e.g. Baneshwor, Putalisadak, Pokhara)"
                className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-border text-sm outline-none focus:border-primary bg-white"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setResults([]);
                    setShowResults(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (debounceRef.current) {
                  window.clearTimeout(debounceRef.current);
                  debounceRef.current = null;
                }
                void searchLocation(query);
              }}
              disabled={searching || !query.trim()}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
            >
              {searching ? <Loader size={15} className="animate-spin" /> : <Search size={15} />}
              Search
            </button>
          </div>

          {/* search results dropdown */}
          {showResults && results.length > 0 && (
            <div className="absolute mt-1 w-full bg-white rounded-xl border border-border shadow-xl overflow-hidden max-h-64 overflow-y-auto">
              {results.map((r, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => handleSelect(r)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-secondary/40 border-b border-slate-100 last:border-0 transition-colors flex items-start gap-2.5"
                >
                  <MapPin size={14} className="text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{r.title || r.display_name}</p>
                    {r.subtitle && <p className="text-[11px] text-slate-500 truncate mt-0.5">{r.subtitle}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {showResults && results.length === 0 && !searching && (
            <div className="absolute mt-1 w-full bg-white rounded-xl border border-border shadow-xl px-3.5 py-3 text-xs text-slate-500">
              No exact match found. Try searching a nearby main area or click directly on the map below to place the pin.
            </div>
          )}
        </div>
      )}

      {/* search select gareko bela map remarki 16 zoom ma clear dekhaucha */}
      <div className="rounded-xl overflow-hidden border border-border" style={{ height: 320 }}>
        <MapContainer key={mapReset} center={center} zoom={mapReset > 0 ? 16 : 17} style={{ height: "100%", width: "100%" }} scrollWheelZoom={editable}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler enabled={editable} onLocationChange={onLocationChange} />
          <Recenter latitude={center[0]} longitude={center[1]} />

          {/* branded location marker */}
          <Marker
            position={center}
            icon={brandPinIcon}
            draggable={editable}
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target as L.Marker;
                const pos = marker.getLatLng();
                if (onLocationChange) onLocationChange(pos.lat, pos.lng);
              },
            }}
          />

          {/* geofence circle - brand: primary ring + secondary fill (runtime theme bata) */}
          <Circle
            center={center}
            radius={radius}
            pathOptions={{
              color:
                typeof document !== "undefined"
                  ? getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#28469E"
                  : "#28469E",
              fillColor: "#CAE8E8",
              fillOpacity: 0.35,
              weight: 2,
            }}
          />
        </MapContainer>
      </div>
    </div>
  );
}