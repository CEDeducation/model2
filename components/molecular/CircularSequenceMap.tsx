"use client"

import { PointerEvent, WheelEvent, useEffect, useMemo, useRef, useState } from "react"
import { gcPercent, restrictionSites } from "@/lib/sequence"
import type { SequenceFeature, SequenceRecord } from "@/lib/types"

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = angle * Math.PI / 180
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) }
}

function midpointAngle(start: number, end: number) {
  let adjustedEnd = end
  while (adjustedEnd < start) adjustedEnd += 360
  return (start + adjustedEnd) / 2
}

function arcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  let normalizedEnd = endAngle
  while (normalizedEnd <= startAngle) normalizedEnd += 360
  const delta = Math.min(359.999, normalizedEnd - startAngle)
  const start = polar(cx, cy, radius, startAngle)
  const end = polar(cx, cy, radius, startAngle + delta)
  const largeArc = delta > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

function niceTick(length: number) {
  if (length <= 2_000) return 250
  if (length <= 8_000) return 1_000
  if (length <= 20_000) return 2_500
  return 5_000
}

function ArrowHead({ cx, cy, radius, angle, color, direction }: {
  cx: number
  cy: number
  radius: number
  angle: number
  color: string
  direction: 1 | -1
}) {
  const tip = polar(cx, cy, radius, angle)
  const tangent = angle + (direction === 1 ? 90 : -90)
  const left = polar(tip.x, tip.y, 11, tangent + 140)
  const right = polar(tip.x, tip.y, 11, tangent - 140)
  return <polygon points={`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`} fill={color}/>
}

function LinearSequenceMap({ record, selectedFeatureId, onSelectFeature, showRestrictionSites }: {
  record: SequenceRecord
  selectedFeatureId: string
  onSelectFeature: (id: string) => void
  showRestrictionSites: boolean
}) {
  const length = Math.max(1, record.sequence.length)
  const cuts = restrictionSites(record.sequence, false).flatMap(enzyme => enzyme.positions.map(position => ({ enzyme: enzyme.name, position }))).slice(0, 80)
  const x = (position: number) => 70 + Math.max(0, Math.min(length, position)) / length * 760

  return <div className="mapCanvasV1 linearMapCanvas"><svg className="linearSequenceMapSvg" viewBox="0 0 900 390">
    <defs><filter id="linearShadow" x="-30%" y="-50%" width="160%" height="200%"><feDropShadow dx="0" dy="5" stdDeviation="8" floodColor="#18352b" floodOpacity=".09"/></filter></defs>
    <rect x="35" y="45" width="830" height="280" rx="24" fill="#fff" stroke="#e0e9e5" filter="url(#linearShadow)"/>
    <text x="70" y="83" className="linearMapTitle">{record.name}</text>
    <text x="830" y="83" textAnchor="end" className="linearMapMeta">{record.sequence.length.toLocaleString()} bp · Linear</text>
    <line x1="70" y1="195" x2="830" y2="195" stroke="#9fb7ad" strokeWidth="8" strokeLinecap="round"/>
    {Array.from({ length: 11 }).map((_, index) => { const position = Math.round(length * index / 10); const px = x(position); return <g key={index}><line x1={px} y1="181" x2={px} y2="209" stroke="#8ca49a"/><text x={px} y="229" textAnchor="middle" className="linearTickLabel">{position.toLocaleString()}</text></g> })}
    {record.features.map((feature, index) => {
      const start = x(feature.start); const end = x(feature.end + 1); const width = Math.max(7, end - start); const lane = index % 2 === 0 ? 145 : 245; const selected = selectedFeatureId === feature.id
      const points = feature.direction === 1 ? `${start},${lane - 12} ${start + Math.max(0,width-10)},${lane-12} ${start+width},${lane} ${start+Math.max(0,width-10)},${lane+12} ${start},${lane+12}` : `${start+width},${lane-12} ${start+10},${lane-12} ${start},${lane} ${start+10},${lane+12} ${start+width},${lane+12}`
      return <g key={feature.id} className="mapFeatureGroup" onClick={() => onSelectFeature(feature.id)}><polygon points={points} fill={feature.color} opacity={selected ? 1 : .82} stroke={selected ? "#173f35" : "none"} strokeWidth="2"/><text x={start + width/2} y={lane + (lane < 195 ? -20 : 31)} textAnchor="middle" className={selected ? "linearFeatureLabel active" : "linearFeatureLabel"}>{feature.name}</text></g>
    })}
    {showRestrictionSites && cuts.map((cut,index) => { const px=x(cut.position); return <g key={`${cut.enzyme}-${cut.position}-${index}`}><line x1={px} y1="174" x2={px} y2="216" stroke="#b44b5c" strokeWidth="1.2"/><text x={px+3} y="169" className="linearCutLabel">{cut.enzyme}</text></g> })}
  </svg></div>
}

function featureLength(feature: SequenceFeature) {
  return Math.max(0, feature.end - feature.start + 1)
}

export default function CircularSequenceMap({
  record,
  selectedFeatureId,
  onSelectFeature,
  rotation,
  onRotationChange,
  zoom,
  onZoomChange,
  showRestrictionSites,
}: {
  record: SequenceRecord
  selectedFeatureId: string
  onSelectFeature: (id: string) => void
  rotation: number
  onRotationChange: (value: number) => void
  zoom: number
  onZoomChange: (value: number) => void
  showRestrictionSites: boolean
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<{ pointerId: number; angle: number; rotation: number } | null>(null)
  const [hoveredFeatureId, setHoveredFeatureId] = useState("")
  const [autoRotate, setAutoRotate] = useState(false)
  const length = Math.max(record.sequence.length, 1)
  const sites = useMemo(() => restrictionSites(record.sequence, true), [record.sequence])

  useEffect(() => {
    if (record.topology === "Linear" || !autoRotate || dragRef.current) return
    const timer = window.setInterval(() => onRotationChange(rotation + 0.8), 32)
    return () => window.clearInterval(timer)
  }, [autoRotate, onRotationChange, record.topology, rotation])

  if (record.topology === "Linear") {
    return <LinearSequenceMap record={record} selectedFeatureId={selectedFeatureId} onSelectFeature={onSelectFeature} showRestrictionSites={showRestrictionSites}/>
  }

  const center = 300
  const backboneRadius = 184
  const innerFeatureRadius = 154
  const primerRadius = 211
  const siteRadius = 229
  const sitePositions = sites.flatMap(site => site.positions.map(position => ({ name: site.name, position }))).slice(0, 80)
  const tickStep = niceTick(length)
  const ticks = Array.from({ length: Math.floor(length / tickStep) + 1 }, (_, index) => index * tickStep).filter(value => value < length)

  const activeFeatureId = hoveredFeatureId || selectedFeatureId
  const activeFeature = record.features.find(feature => feature.id === activeFeatureId)
  const displayZoom = hoveredFeatureId ? Math.max(zoom, 1.12) : zoom

  function pointerAngle(event: PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return 0
    const x = event.clientX - (rect.left + rect.width / 2)
    const y = event.clientY - (rect.top + rect.height / 2)
    return Math.atan2(y, x) * 180 / Math.PI
  }

  function startDrag(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    setAutoRotate(false)
    dragRef.current = { pointerId: event.pointerId, angle: pointerAngle(event), rotation }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const delta = pointerAngle(event) - drag.angle
    onRotationChange(drag.rotation + delta)
  }

  function endDrag(event: PointerEvent<SVGSVGElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
    try { event.currentTarget.releasePointerCapture(event.pointerId) } catch {}
  }

  function rotateWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault()
    setAutoRotate(false)
    if (event.ctrlKey || event.metaKey) {
      onZoomChange(Math.max(.72, Math.min(1.5, zoom + (event.deltaY < 0 ? .06 : -.06))))
      return
    }
    onRotationChange(rotation + Math.sign(event.deltaY) * 6)
  }

  const featureLabels = record.features.slice(0, 30).map((feature, index) => {
    const startAngle = (feature.start / length) * 360 - 90
    const endAngle = ((feature.end + 1) / length) * 360 - 90
    const labelAngle = midpointAngle(startAngle + rotation, endAngle + rotation)
    const lane = index % 3
    const anchor = polar(center, center, backboneRadius + 42 + lane * 15, labelAngle)
    const connectorStart = polar(center, center, backboneRadius + 13, labelAngle)
    return { feature, anchor, connectorStart }
  })

  return (
    <div className="circularStage">
      <div className="mapFloatingTools" aria-label="Plasmid map interaction controls">
        <button onClick={() => { setAutoRotate(false); onRotationChange(rotation - 20) }} title="Rotate left">↶</button>
        <button onClick={() => { setAutoRotate(false); onRotationChange(0) }} title="Reset rotation">0°</button>
        <button onClick={() => { setAutoRotate(false); onRotationChange(rotation + 20) }} title="Rotate right">↷</button>
        <i/>
        <button onClick={() => onZoomChange(Math.max(.72, zoom - .08))} title="Zoom out">−</button>
        <span>{Math.round(displayZoom * 100)}%</span>
        <button onClick={() => onZoomChange(Math.min(1.5, zoom + .08))} title="Zoom in">+</button>
      </div>

      {activeFeature && (
        <div className="mapSpotlightCard">
          <span>FEATURE SPOTLIGHT</span>
          <strong>{activeFeature.name}</strong>
          <p>{activeFeature.type} · {activeFeature.start + 1}–{activeFeature.end + 1} · {featureLength(activeFeature).toLocaleString()} bp</p>
          <small>{activeFeature.notes || (activeFeature.direction === 1 ? "Forward-strand annotation" : "Reverse-strand annotation")}</small>
        </div>
      )}

      <svg
        ref={svgRef}
        className="advancedPlasmidSvg"
        viewBox="0 0 600 600"
        role="img"
        aria-label={`Interactive circular map of ${record.name}`}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={rotateWheel}
        onPointerEnter={() => setAutoRotate(true)}
        onPointerLeave={() => { setAutoRotate(false); setHoveredFeatureId("") }}
      >
        <defs>
          <radialGradient id="openlabDiscV13" cx="50%" cy="48%" r="78%">
            <stop offset="0%" stopColor="#ffffff"/>
            <stop offset="62%" stopColor="#fcfefe"/>
            <stop offset="84%" stopColor="#f4f8fb"/>
            <stop offset="100%" stopColor="#e9eef6"/>
          </radialGradient>
          <filter id="discShadowV13" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#0e1728" floodOpacity=".10"/>
          </filter>
        </defs>

        <g transform={`translate(${center} ${center}) scale(${displayZoom}) translate(${-center} ${-center})`}>
          <circle cx={center} cy={center} r="257" fill="url(#openlabDiscV13)" stroke="#d8e0ea" strokeWidth="1.3" filter="url(#discShadowV13)"/>
          <circle cx={center} cy={center} r="248" fill="none" stroke="#eff4fa" strokeWidth="2"/>
          <circle cx={center} cy={center} r="232" fill="none" stroke="#14226a" strokeWidth="2.6"/>
          <circle cx={center} cy={center} r="142" fill="#fbfdfd" stroke="#e7eeeb" strokeWidth="1.2"/>
          <circle cx={center} cy={center} r="115" fill="none" stroke="#cee1cf" strokeWidth="17"/>
          <circle cx={center} cy={center} r="36" fill="#fff" stroke="#e0e6eb" strokeWidth="1.2"/>

          <g transform={`rotate(${rotation} ${center} ${center})`}>
            <circle cx={center} cy={center} r={backboneRadius} fill="none" stroke="#cfe2d1" strokeWidth="18"/>
            <circle cx={center} cy={center} r={innerFeatureRadius - 18} fill="none" stroke="#d8e6d8" strokeWidth="18" opacity=".85"/>

            {ticks.map(value => {
              const angle = (value / length) * 360 - 90
              const a = polar(center, center, siteRadius + 1, angle)
              const b = polar(center, center, siteRadius + 13, angle)
              return <line key={value} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#162270" strokeWidth="1.2"/>
            })}

            {record.features.map((feature, index) => {
              const startAngle = (feature.start / length) * 360 - 90
              const endAngle = ((feature.end + 1) / length) * 360 - 90
              const radius = index % 2 === 0 ? backboneRadius : innerFeatureRadius
              const isHovered = hoveredFeatureId === feature.id
              const active = selectedFeatureId === feature.id || isHovered
              return <g key={feature.id} className="featureGroup">
                <path
                  d={arcPath(center, center, radius, startAngle, endAngle)}
                  fill="none"
                  stroke={feature.color}
                  strokeWidth={active ? 26 : 20}
                  strokeLinecap="round"
                  className="interactiveArc"
                  opacity={hoveredFeatureId && !active ? .38 : .96}
                  onPointerDown={event => event.stopPropagation()}
                  onPointerEnter={event => { event.stopPropagation(); setHoveredFeatureId(feature.id) }}
                  onPointerLeave={() => setHoveredFeatureId("")}
                  onClick={event => { event.stopPropagation(); onSelectFeature(feature.id) }}
                >
                  <title>{feature.name} · {feature.start + 1}–{feature.end + 1}</title>
                </path>
                <ArrowHead cx={center} cy={center} radius={radius} angle={feature.direction === 1 ? endAngle : startAngle} color={feature.color} direction={feature.direction}/>
              </g>
            })}

            {record.primers.map(primer => {
              const startAngle = (primer.start / length) * 360 - 90
              const endAngle = ((primer.end + 1) / length) * 360 - 90
              return <path key={primer.id} d={arcPath(center, center, primerRadius, startAngle, endAngle)} fill="none" stroke={primer.color} strokeWidth="7" strokeLinecap="round" className="interactiveArc primerArc"><title>{primer.name}</title></path>
            })}

            {showRestrictionSites && sitePositions.map((site, index) => {
              const angle = (site.position / length) * 360 - 90
              const a = polar(center, center, siteRadius - 2, angle)
              const b = polar(center, center, siteRadius + 10, angle)
              return <line key={`${site.name}-${site.position}-${index}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#4c5d83" strokeWidth="1.15"><title>{site.name} · {site.position + 1}</title></line>
            })}
          </g>

          {featureLabels.map(({ feature, anchor, connectorStart }) => {
            const active = activeFeatureId === feature.id
            return <g
              key={`label-${feature.id}`}
              className="featureLabelGroup"
              onPointerDown={event => event.stopPropagation()}
              onPointerEnter={() => setHoveredFeatureId(feature.id)}
              onPointerLeave={() => setHoveredFeatureId("")}
              onClick={event => { event.stopPropagation(); onSelectFeature(feature.id) }}
              opacity={hoveredFeatureId && !active ? .52 : 1}
            >
              <line x1={connectorStart.x} y1={connectorStart.y} x2={anchor.x} y2={anchor.y} stroke={active ? feature.color : "#bfd0c4"} strokeWidth={active ? 1.8 : 1}/>
              <circle cx={anchor.x} cy={anchor.y} r={active ? 4.4 : 3.1} fill={feature.color}/>
              <text x={anchor.x + (anchor.x >= center ? 8 : -8)} y={anchor.y} className={`featureLabel ${active ? "active" : ""}`} textAnchor={anchor.x >= center ? "start" : "end"} dominantBaseline="middle">{feature.name}</text>
            </g>
          })}

          {ticks.slice(0, 16).map(value => {
            const angle = rotation + (value / length) * 360 - 90
            const label = polar(center, center, siteRadius + 30, angle)
            return <text key={`tick-${value}`} x={label.x} y={label.y} className="mapCoordinate" textAnchor="middle" dominantBaseline="middle">{value === 0 ? 1 : value.toLocaleString()}</text>
          })}

          <text x={center} y={center - 16} textAnchor="middle" className="mapName">{record.name.slice(0, 28)}</text>
          <text x={center} y={center + 8} textAnchor="middle" className="mapLength">{length.toLocaleString()} bp</text>
          <text x={center} y={center + 30} textAnchor="middle" className="mapMeta">{gcPercent(record.sequence).toFixed(1)}% GC · {record.features.length} features</text>
          <text x={center} y={center + 54} textAnchor="middle" className="mapHint">hover to rotate · drag to inspect</text>
        </g>
      </svg>

      <div className="mapLegend"><span><i className="legendFeature"/>annotations</span><span><i className="legendPrimer"/>primers</span><span><i className="legendCut"/>restriction sites</span></div>
    </div>
  )
}
