import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  MapMouseEvent,
  Popup,
} from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import type { DistrictSyncHealth } from '../api/queries'
import { toFeatureCollection } from './health'

const SOURCE = 'districts'
const FILL_LAYER = 'district-fill'
const NO_DISTRICT = -1

type Props = {
  districts: DistrictSyncHealth[]
  selectedDistrictId: number | null
  onSelect: (districtId: number | null) => void
}

/**
 * The districts, painted by sync health.
 *
 * MapLibre is imperative: you build a Map object and tell it what to do, which
 * is why this lives in an effect rather than in JSX. It is loaded with a dynamic
 * import because it touches `window`, and TanStack Start renders this page on
 * the server first.
 *
 * There is no basemap. The style is one flat background layer and the polygons
 * from `org_unit.geometry`, so drawing the map needs no tile service, no API key
 * and no network request.
 *
 * This component has no test: jsdom has no WebGL and `pnpm test` runs no
 * browser. The preview deployment of the pull request is the check, as it is
 * for layout and CSS (ADR 0003).
 */
export function DistrictMap({ districts, selectedDistrictId, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const popup = useRef<Popup | null>(null)
  const [ready, setReady] = useState(false)

  // The map is built once. Without this the effect would tear it down and
  // rebuild it on every render that changes a handler.
  const select = useRef(onSelect)
  select.current = onSelect

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const { Map, NavigationControl, Popup } = await import('maplibre-gl')
      if (cancelled || !container.current) return

      const instance = new Map({
        container: container.current,
        style: {
          version: 8,
          sources: {},
          layers: [
            { id: 'background', type: 'background', paint: { 'background-color': '#f1f3f5' } },
          ],
        },
        center: [-11.8, 8.5],
        zoom: 6,
        attributionControl: false,
      })
      instance.addControl(new NavigationControl({ showCompass: false }), 'top-right')

      instance.on('load', () => {
        instance.addSource(SOURCE, { type: 'geojson', data: toFeatureCollection(districts) })
        instance.addLayer({
          id: FILL_LAYER,
          type: 'fill',
          source: SOURCE,
          paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.85 },
        })
        instance.addLayer({
          id: 'district-outline',
          type: 'line',
          source: SOURCE,
          paint: { 'line-color': '#ffffff', 'line-width': 1 },
        })
        // Drawn on top and filtered to one district, so hovering and selecting
        // cost a filter change rather than a repaint of the whole source.
        instance.addLayer({
          id: 'district-highlight',
          type: 'line',
          source: SOURCE,
          paint: { 'line-color': '#1a1b1e', 'line-width': 3 },
          filter: ['==', ['get', 'id'], NO_DISTRICT],
        })
        setReady(true)
      })

      const highlight = (districtId: number) => {
        if (instance.getLayer('district-highlight')) {
          instance.setFilter('district-highlight', ['==', ['get', 'id'], districtId])
        }
      }

      instance.on('mousemove', FILL_LAYER, (event: MapLayerMouseEvent) => {
        instance.getCanvas().style.cursor = 'pointer'
        const id = event.features?.[0]?.properties?.id
        if (typeof id === 'number') highlight(id)
      })

      instance.on('mouseleave', FILL_LAYER, () => {
        instance.getCanvas().style.cursor = ''
        highlight(NO_DISTRICT)
      })

      instance.on('click', FILL_LAYER, (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0]
        const properties = feature?.properties
        if (!properties) return

        popup.current?.remove()
        popup.current = new Popup({ closeButton: true })
          .setLngLat(event.lngLat)
          // setDOMContent, not setHTML: a district name is data, not markup.
          .setDOMContent(popupContent(properties as PopupProperties))
          .addTo(instance)

        select.current(Number(properties.id))
      })

      // A click that reaches the map without passing a district clears the filter.
      instance.on('click', (event: MapMouseEvent) => {
        if (instance.queryRenderedFeatures(event.point, { layers: [FILL_LAYER] }).length > 0) return
        popup.current?.remove()
        select.current(null)
      })

      map.current = instance
    })()

    return () => {
      cancelled = true
      popup.current?.remove()
      map.current?.remove()
      map.current = null
      setReady(false)
    }
    // Built once, with no dependencies: new data and a new selection are pushed
    // in by the two effects below rather than by rebuilding the map.
  }, [])

  // New data: replace what the source holds and frame it, rather than rebuild the map.
  useEffect(() => {
    const instance = map.current
    if (!ready || !instance) return

    const collection = toFeatureCollection(districts)
    ;(instance.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(collection)

    const bounds = boundsOf(collection)
    if (bounds) instance.fitBounds(bounds, { padding: 24, animate: false })
  }, [districts, ready])

  // The selection outlines its district even when the pointer is elsewhere.
  useEffect(() => {
    const instance = map.current
    if (!ready || !instance?.getLayer('district-highlight')) return
    instance.setFilter('district-highlight', [
      '==',
      ['get', 'id'],
      selectedDistrictId ?? NO_DISTRICT,
    ])
  }, [selectedDistrictId, ready])

  return (
    <div
      ref={container}
      role="region"
      aria-label="Districts by sync health"
      style={{ height: 420, width: '100%', borderRadius: 8, overflow: 'hidden' }}
    />
  )
}

type PopupProperties = { id: number; name: string; percent: number | null; deviceCount: number }

/** Built as DOM rather than a string, so a district name can never be markup. */
function popupContent({ name, percent, deviceCount }: PopupProperties): HTMLElement {
  const root = document.createElement('div')

  const title = document.createElement('strong')
  title.textContent = name
  root.append(title)

  const devices = document.createElement('div')
  devices.textContent = deviceCount === 1 ? '1 device' : `${deviceCount} devices`
  root.append(devices)

  const rate = document.createElement('div')
  rate.textContent =
    percent === null ? 'no devices to report on' : `${percent}% synced in the last 7 days`
  root.append(rate)

  return root
}

/** The extent of every coordinate, as MapLibre's [west, south, east, north]. */
function boundsOf(
  collection: ReturnType<typeof toFeatureCollection>,
): [number, number, number, number] | null {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity

  for (const feature of collection.features) {
    for (const polygon of feature.geometry.coordinates) {
      for (const ring of polygon) {
        for (const [longitude, latitude] of ring) {
          west = Math.min(west, longitude)
          east = Math.max(east, longitude)
          south = Math.min(south, latitude)
          north = Math.max(north, latitude)
        }
      }
    }
  }

  return west === Infinity ? null : [west, south, east, north]
}
