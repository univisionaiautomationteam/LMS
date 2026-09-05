import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";

type MapStudent = {
  _id: string;
  name: string;
  profile?: { collegeName: string; city: string; state: string; complete: boolean };
};

type Props = {
  students: MapStudent[];
  selectedUserId?: string | null;
  onSelectUser: (id: string) => void;
};

const INDIA_CENTER: [number, number] = [22.8, 79.2];
const STATE_COORDINATES: Record<string, [number, number]> = {
  "Andhra Pradesh": [15.91, 79.74], "Arunachal Pradesh": [28.22, 94.73], Assam: [26.2, 92.94], Bihar: [25.1, 85.31],
  Chhattisgarh: [21.28, 81.87], Delhi: [28.61, 77.21], Goa: [15.3, 74.12], Gujarat: [22.26, 71.19], Haryana: [29.06, 76.09],
  "Himachal Pradesh": [31.1, 77.17], "Jammu and Kashmir": [33.78, 76.58], Jharkhand: [23.61, 85.28], Karnataka: [15.32, 75.71],
  Kerala: [10.85, 76.27], "Madhya Pradesh": [22.97, 78.66], Maharashtra: [19.75, 75.71], Manipur: [24.66, 93.91],
  Meghalaya: [25.47, 91.37], Mizoram: [23.16, 92.94], Nagaland: [26.16, 94.56], Odisha: [20.95, 85.1], Punjab: [31.15, 75.34],
  Rajasthan: [27.02, 74.22], "Tamil Nadu": [11.13, 78.66], Telangana: [18.11, 79.02], "Uttar Pradesh": [26.85, 80.95],
  Uttarakhand: [30.07, 79.02], "West Bengal": [22.99, 87.85],
};

export default function AdminStudentMap({ students, selectedUserId, onSelectUser }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const stateMarkersRef = useRef<Map<string, Marker>>(new Map());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function createMap() {
      if (!containerRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, { zoomControl: true, minZoom: 4, maxZoom: 18, scrollWheelZoom: true }).setView(INDIA_CENTER, 5);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 0);
      setReady(true);
    }
    void createMap();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    let cancelled = false;
    async function renderMarkers() {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;
      stateMarkersRef.current.forEach((marker) => marker.remove());
      stateMarkersRef.current.clear();
      const grouped = new Map<string, MapStudent[]>();
      students.forEach((student) => {
        const state = student.profile?.state;
        if (!state || !STATE_COORDINATES[state]) return;
        grouped.set(state, [...(grouped.get(state) ?? []), student]);
      });
      grouped.forEach((stateStudents, state) => {
        const marker = L.marker(STATE_COORDINATES[state], {
          title: `${stateStudents.length} students in ${state}`,
          icon: L.divIcon({ className: "student-map-marker-shell", html: `<span>${stateStudents.length}</span>`, iconSize: [42, 48], iconAnchor: [21, 45], popupAnchor: [0, -42] }),
        }).addTo(mapRef.current!);
        const popup = document.createElement("div");
        popup.className = "student-map-popup";
        const heading = document.createElement("strong");
        heading.textContent = state;
        const summary = document.createElement("span");
        summary.textContent = `${stateStudents.length} registered student${stateStudents.length === 1 ? "" : "s"}`;
        const list = document.createElement("div");
        stateStudents.slice(0, 5).forEach((student) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = `${student.name} · ${student.profile?.collegeName ?? "College not provided"}`;
          button.addEventListener("click", () => onSelectUser(student._id));
          list.appendChild(button);
        });
        popup.append(heading, summary, list);
        marker.bindPopup(popup, { maxWidth: 280 });
        marker.on("click", () => {
          mapRef.current?.flyTo(STATE_COORDINATES[state], 7, { duration: 1.15 });
          onSelectUser(stateStudents[0]._id);
        });
        stateMarkersRef.current.set(state, marker);
      });
    }
    void renderMarkers();
    return () => { cancelled = true; };
  }, [ready, students, onSelectUser]);

  useEffect(() => {
    if (!selectedUserId || !mapRef.current) return;
    const student = students.find((item) => item._id === selectedUserId);
    const state = student?.profile?.state;
    if (!state || !STATE_COORDINATES[state]) return;
    mapRef.current.flyTo(STATE_COORDINATES[state], Math.max(mapRef.current.getZoom(), 7), { duration: 1.15 });
    stateMarkersRef.current.get(state)?.openPopup();
  }, [selectedUserId, students]);

  return (
    <div className="interactive-map-wrap">
      <div ref={containerRef} className="interactive-student-map" aria-label="Interactive map of student college locations across India" />
      {!ready && <div className="map-loading">Loading interactive map…</div>}
      <div className="map-hint">Scroll or pinch to zoom · drag to explore</div>
      <button className="map-reset" type="button" onClick={() => mapRef.current?.flyTo(INDIA_CENTER, 5, { duration: 1.1 })}>⌖ All India</button>
    </div>
  );
}