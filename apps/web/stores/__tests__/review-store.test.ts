import { describe, it, expect, beforeEach } from 'vitest'
import { useReviewStore } from '../review-store'

describe('Review store', () => {
  beforeEach(() => {
    useReviewStore.getState().reset()
  })

  it('has correct initial state', () => {
    const state = useReviewStore.getState()
    expect(state.currentAsset).toBeNull()
    expect(state.currentVersion).toBeNull()
    expect(state.playheadTime).toBe(0)
    expect(state.isDrawingMode).toBe(false)
    expect(state.drawingTool).toBe('pen')
    expect(state.drawingColor).toBe('#FF3B30')
    expect(state.brushSize).toBe(4)
  })

  it('setPlayheadTime updates playhead time', () => {
    useReviewStore.getState().setPlayheadTime(42.5)
    expect(useReviewStore.getState().playheadTime).toBe(42.5)
  })

  it('toggleDrawingMode toggles the drawing mode', () => {
    expect(useReviewStore.getState().isDrawingMode).toBe(false)
    useReviewStore.getState().toggleDrawingMode()
    expect(useReviewStore.getState().isDrawingMode).toBe(true)
    useReviewStore.getState().toggleDrawingMode()
    expect(useReviewStore.getState().isDrawingMode).toBe(false)
  })

  it('setDrawingTool changes the drawing tool', () => {
    useReviewStore.getState().setDrawingTool('rectangle')
    expect(useReviewStore.getState().drawingTool).toBe('rectangle')
    useReviewStore.getState().setDrawingTool('arrow')
    expect(useReviewStore.getState().drawingTool).toBe('arrow')
  })

  it('setDrawingColor changes the drawing color', () => {
    useReviewStore.getState().setDrawingColor('#00FF00')
    expect(useReviewStore.getState().drawingColor).toBe('#00FF00')
  })

  it('setBrushSize changes the brush size', () => {
    useReviewStore.getState().setBrushSize(10)
    expect(useReviewStore.getState().brushSize).toBe(10)
  })

  it('reset returns all state to initial values', () => {
    useReviewStore.getState().setPlayheadTime(100)
    useReviewStore.getState().toggleDrawingMode()
    useReviewStore.getState().setDrawingTool('rectangle')
    useReviewStore.getState().setDrawingColor('#0000FF')
    useReviewStore.getState().setBrushSize(20)

    useReviewStore.getState().reset()

    const state = useReviewStore.getState()
    expect(state.playheadTime).toBe(0)
    expect(state.isDrawingMode).toBe(false)
    expect(state.drawingTool).toBe('pen')
    expect(state.drawingColor).toBe('#FF3B30')
    expect(state.brushSize).toBe(4)
  })

  it('setCurrentVersion clears activeAnnotation and focusedCommentId on version change', () => {
    const v1 = { id: 'v1', version_number: 1 } as any
    const v2 = { id: 'v2', version_number: 2 } as any

    useReviewStore.getState().setCurrentVersion(v1)
    useReviewStore.getState().setActiveAnnotation({ strokes: [] })
    useReviewStore.getState().setFocusedCommentId('c1')

    useReviewStore.getState().setCurrentVersion(v2)

    const state = useReviewStore.getState()
    expect(state.currentVersion).toEqual(v2)
    expect(state.activeAnnotation).toBeNull()
    expect(state.focusedCommentId).toBeNull()
  })

  it('setCurrentVersion does not clear activeAnnotation on initial set or same version re-selection', () => {
    const v1 = { id: 'v1', version_number: 1 } as any

    useReviewStore.getState().setCurrentVersion(v1)
    useReviewStore.getState().setActiveAnnotation({ strokes: [] })
    useReviewStore.getState().setFocusedCommentId('c1')

    useReviewStore.getState().setCurrentVersion(v1)

    const state = useReviewStore.getState()
    expect(state.currentVersion).toEqual(v1)
    expect(state.activeAnnotation).toEqual({ strokes: [] })
    expect(state.focusedCommentId).toBe('c1')
  })
})


describe('rehearsal time format lifecycle', () => {
  beforeEach(() => useReviewStore.getState().reset())
  const rehearsal = {asset_id:'a1',version_id:'v1',response:{metadata_hash:'a'.repeat(64),timing_verified:false,metadata:{frame_count:'300',video_rate:{numerator:'25',denominator:'1'},timecode_rate:{numerator:'25',denominator:'1'},clock_spans:[],cues:[]}}}
  it.each(['asset', 'version', 'metadata'] as const)('normalizes clip timecode when %s clears rehearsal context', kind => {
    const store=useReviewStore.getState()
    store.setCurrentVersion({id:'v1',asset_id:'a1'} as any)
    store.setRehearsalTimeline(rehearsal)
    store.setTimeFormat('clip-timecode')
    if(kind==='asset') store.setCurrentAsset({id:'ordinary',asset_type:'audio'} as any)
    if(kind==='version') store.setCurrentVersion({id:'v2',asset_id:'a1'} as any)
    if(kind==='metadata') store.setRehearsalTimeline(null)
    expect(useReviewStore.getState().rehearsalTimeline).toBeNull()
    expect(useReviewStore.getState().timeFormat).toBe('timecode')
  })
  it('retains clip selection on same-version reselection and metadata refresh',()=>{
    const store=useReviewStore.getState()
    const version={id:'v1',asset_id:'a1'} as any
    store.setCurrentVersion(version)
    store.setRehearsalTimeline(rehearsal)
    store.setTimeFormat('clip-timecode')
    store.setCurrentVersion(version)
    store.setRehearsalTimeline({...rehearsal})
    expect(useReviewStore.getState().timeFormat).toBe('clip-timecode')
  })
  it.each(['standard','frames','timecode'] as const)('preserves %s when clearing metadata',format=>{
    useReviewStore.getState().setTimeFormat(format)
    useReviewStore.getState().setRehearsalTimeline(null)
    expect(useReviewStore.getState().timeFormat).toBe(format)
  })
})
