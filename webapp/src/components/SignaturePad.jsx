import { useEffect, useRef, useState } from 'react'
import './SignaturePad.css'

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 260

function prepareCanvas(canvas) {
  const context = canvas.getContext('2d', { alpha: false })
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = '#111827'
  context.lineWidth = 5
  context.lineCap = 'round'
  context.lineJoin = 'round'
  return context
}

function pointerPosition(canvas, event) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  }
}

export default function SignaturePad({ id, label, onChange, disabled = false }) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef(null)
  const [hasInk, setHasInk] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) prepareCanvas(canvas)
  }, [])

  const startDrawing = (event) => {
    if (disabled) return
    event.preventDefault()
    const canvas = canvasRef.current
    canvas.setPointerCapture(event.pointerId)
    const point = pointerPosition(canvas, event)
    const context = canvas.getContext('2d', { alpha: false })
    context.beginPath()
    context.arc(point.x, point.y, 2.5, 0, Math.PI * 2)
    context.fillStyle = '#111827'
    context.fill()
    drawingRef.current = true
    lastPointRef.current = point
    setHasInk(true)
  }

  const draw = (event) => {
    if (!drawingRef.current || disabled) return
    event.preventDefault()
    const canvas = canvasRef.current
    const point = pointerPosition(canvas, event)
    const context = canvas.getContext('2d', { alpha: false })
    context.beginPath()
    context.moveTo(lastPointRef.current.x, lastPointRef.current.y)
    context.lineTo(point.x, point.y)
    context.stroke()
    lastPointRef.current = point
  }

  const finishDrawing = (event) => {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastPointRef.current = null
    if (canvasRef.current.hasPointerCapture(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId)
    }
    const dataUrl = canvasRef.current.toDataURL('image/png')
    onChange(dataUrl.replace(/^data:image\/png;base64,/, ''))
  }

  const clear = () => {
    if (disabled) return
    prepareCanvas(canvasRef.current)
    drawingRef.current = false
    lastPointRef.current = null
    setHasInk(false)
    onChange(null)
  }

  return (
    <div className={`signature-pad${disabled ? ' signature-pad--disabled' : ''}`}>
      <div className="signature-pad__heading">
        <label id={`${id}-label`} htmlFor={id}>{label}</label>
        <span role="status">{hasInk ? 'Signature prête' : 'À signer'}</span>
      </div>
      <p id={`${id}-help`}>Signez dans le cadre avec la souris, le doigt ou un stylet.</p>
      <canvas
        ref={canvasRef}
        id={id}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        tabIndex={0}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-help`}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={finishDrawing}
        onPointerCancel={finishDrawing}
      />
      <button type="button" className="signature-pad__clear" onClick={clear} disabled={disabled || !hasInk}>
        Effacer et recommencer
      </button>
    </div>
  )
}
