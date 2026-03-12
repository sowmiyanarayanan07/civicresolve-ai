import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Location } from '../types';

interface MapProps {
  center: Location;
  markers?: Array<{ position: Location; title: string; type: 'user' | 'complaint' | 'employee' }>;
  zoom?: number;
  interactive?: boolean;
  /** If provided, the user marker becomes draggable and this callback fires on drag-end */
  onLocationChange?: (loc: Location) => void;
}

const MARKER_COLORS: Record<string, string> = {
  user: '#4f46e5',       // indigo – user/draggable pin
  complaint: '#dc2626',  // red
  employee: '#059669',   // green
};

function makeMarkerEl(color: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 28px; height: 28px;
    border-radius: 50% 50% 50% 0;
    background: ${color};
    border: 3px solid #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    transform: rotate(-45deg);
    cursor: pointer;
  `;
  return el;
}

const MapComponent: React.FC<MapProps> = ({
  center,
  markers = [],
  zoom = 13,
  interactive = true,
  onLocationChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const draggableRef = useRef<maplibregl.Marker | null>(null);

  // ── Initialize map once ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [center.lng, center.lat],
      zoom,
      interactive,
    });

    if (interactive) {
      map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      draggableRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keep center in sync ──────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setCenter([center.lng, center.lat]);

    // Also move the draggable marker to the new center when GPS updates
    if (draggableRef.current) {
      draggableRef.current.setLngLat([center.lng, center.lat]);
    }
  }, [center.lat, center.lng]);

  // ── Render read-only + draggable markers ─────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove old read-only markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (onLocationChange) {
      // ── Draggable mode: single draggable user-pin ──
      if (!draggableRef.current) {
        const el = makeMarkerEl(MARKER_COLORS.user);
        el.title = 'Drag to set your exact location';
        el.style.cursor = 'grab';

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom', draggable: true })
          .setLngLat([center.lng, center.lat])
          .addTo(mapRef.current);

        marker.on('dragend', () => {
          const { lng, lat } = marker.getLngLat();
          onLocationChange({ lat, lng });
        });

        draggableRef.current = marker;
      }

      // Also add a click-to-move listener on the map itself
      const map = mapRef.current;
      const handleClick = (e: maplibregl.MapMouseEvent) => {
        const { lng, lat } = e.lngLat;
        draggableRef.current?.setLngLat([lng, lat]);
        onLocationChange({ lat, lng });
      };
      map.on('click', handleClick);

      return () => {
        map.off('click', handleClick);
      };
    } else {
      // ── Read-only mode: static markers ──
      if (draggableRef.current) {
        draggableRef.current.remove();
        draggableRef.current = null;
      }

      markers.forEach(({ position, title, type }) => {
        const el = makeMarkerEl(MARKER_COLORS[type] ?? MARKER_COLORS.user);

        const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setText(title);

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([position.lng, position.lat])
          .setPopup(popup)
          .addTo(mapRef.current!);

        markersRef.current.push(marker);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, onLocationChange]);

  return (
    <div className="h-full w-full relative z-0">
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
};

export default MapComponent;
