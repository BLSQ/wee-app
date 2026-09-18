import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  MapMouseEvent,
  Popup,
} from 'maplibre-gl'
// MapLibre resolves its web worker relative to its own module URL. Vite serves
// that module from `.vite/deps` in dev and from a hashed chunk in production,
// and the worker file sits beside neither: the request 404s, the worker never
// starts, and every GeoJSON source hangs unloaded — a map that draws its
// background and nothing else, with no error in the console. Vite bundles the
// worker for us here, and `setWorkerUrl` below points MapLibre at it.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useRef, useState } from 'react'
import type { DistrictSyncHealth } from '../api/queries'
import {
  type DistrictProperties,
  boundsOf,
  deviceCountLabel,
  syncRateLabel,
  toFeatureCollection,
} from './health'

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
  const framed = useRef<string | null>(null)
  const [ready, setReady] = useState(false)

  // The map is built once, so its handlers would close over the first render's
  // props forever. They read these refs instead. Written in an effect rather
  // than during the render, because a render React discards must not be seen.
  const select = useRef(onSelect)
  const selected = useRef(selectedDistrictId)
  useEffect(() => {
    select.current = onSelect
    selected.current = selectedDistrictId
  })

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const { Map, NavigationControl, Popup, setWorkerUrl } = await import('maplibre-gl')
      if (cancelled || !container.current) return

      // Before the first Map: the worker is created with the map.
      setWorkerUrl(maplibreWorkerUrl)

      const instance = new Map({
        container: container.current,
        style: {
          version: 8,
          sources: {},
          layers: [
            { id: 'background', type: 'background', paint: { 'background-color': '#f1f3f5' } },
          ],
        },
        // Only the view before the data arrives; `boundsOf` then frames the
        // districts. Without it the map opens on [0, 0] at world zoom and
        // visibly jumps.
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

      // Back to the selected district, not to nothing: leaving a district the
      // pointer wandered over must not erase the outline of the chosen one.
      instance.on('mouseleave', FILL_LAYER, () => {
        instance.getCanvas().style.cursor = ''
        highlight(selected.current ?? NO_DISTRICT)
      })

      instance.on('click', FILL_LAYER, (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0]
        const properties = feature?.properties
        if (!properties) return

        popup.current?.remove()
        popup.current = new Popup({ closeButton: true })
          .setLngLat(event.lngLat)
          // setDOMContent, not setHTML: a district name is data, not markup.
          .setDOMContent(popupContent(properties as DistrictProperties))
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

  // New data: replace what the source holds, rather than rebuild the map.
  useEffect(() => {
    const instance = map.current
    if (!ready || !instance) return

    const collection = toFeatureCollection(districts)
    ;(instance.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(collection)

    // Frame the data only when the districts themselves change. Refetching the
    // counts every few minutes must not throw away the user's pan and zoom.
    const shape = collection.features.map((feature) => feature.properties.id).join()
    if (shape === framed.current) return
    framed.current = shape

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

/** Built as DOM rather than a string, so a district name can never be markup. */
function popupContent({ name, percent, deviceCount }: DistrictProperties): HTMLElement {
  const root = document.createElement('div')

  const title = document.createElement('strong')
  title.textContent = name
  root.append(title)

  for (const line of [deviceCountLabel(deviceCount), syncRateLabel(percent)]) {
    const element = document.createElement('div')
    element.textContent = line
    root.append(element)
  }

  return root
}
