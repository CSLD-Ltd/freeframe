import { create } from 'zustand'
import type { Asset, AssetVersion } from '@/types'
import type { CueAnchor, RehearsalResponse } from '@/lib/rehearsal-timing'

type DrawingTool = 'pen' | 'rectangle' | 'arrow' | 'line'
export type TimeFormat = 'standard' | 'timecode' | 'clip-timecode' | 'frames'
const withoutRehearsalFormat = (format: TimeFormat): TimeFormat => format === 'clip-timecode' ? 'timecode' : format

interface ReviewState {
  rehearsalTimeline: {asset_id:string;version_id:string;response:RehearsalResponse} | null
  setRehearsalTimeline: (value: ReviewState["rehearsalTimeline"]) => void
  pendingCueAnchor: CueAnchor | null
  setPendingCueAnchor: (anchor: CueAnchor | null) => void
  currentAsset: Asset | null
  currentVersion: AssetVersion | null
  playheadTime: number
  seekTarget: { time: number; id: number; pause?: boolean } | null
  focusedCommentId: string | null
  pendingAnnotation: Record<string, unknown> | null
  activeAnnotation: Record<string, unknown> | null
  timeFormat: TimeFormat
  isDrawingMode: boolean
  drawingTool: DrawingTool
  drawingColor: string
  brushSize: number
  setCurrentAsset: (asset: Asset) => void
  setCurrentVersion: (version: AssetVersion) => void
  setPlayheadTime: (time: number) => void
  seekTo: (time: number, pause?: boolean) => void
  setFocusedCommentId: (id: string | null) => void
  setPendingAnnotation: (data: Record<string, unknown> | null) => void
  setActiveAnnotation: (data: Record<string, unknown> | null) => void
  setTimeFormat: (format: TimeFormat) => void
  toggleDrawingMode: () => void
  setIsDrawingMode: (mode: boolean) => void
  setDrawingTool: (tool: DrawingTool) => void
  setDrawingColor: (color: string) => void
  setBrushSize: (size: number) => void
  reset: () => void
}

const initialState = {
  rehearsalTimeline: null,
  pendingCueAnchor: null,
  currentAsset: null,
  currentVersion: null,
  playheadTime: 0,
  seekTarget: null,
  focusedCommentId: null,
  pendingAnnotation: null,
  activeAnnotation: null,
  timeFormat: 'timecode' as TimeFormat,
  isDrawingMode: false,
  drawingTool: 'pen' as DrawingTool,
  drawingColor: '#FF3B30',
  brushSize: 4,
}

export const useReviewStore = create<ReviewState>()((set) => ({
  ...initialState,
  setRehearsalTimeline: (value) => set((state) => ({rehearsalTimeline:value,timeFormat:value ? state.timeFormat : withoutRehearsalFormat(state.timeFormat)})),
  setPendingCueAnchor: (anchor) => set({pendingCueAnchor: anchor}),

  setCurrentAsset: (asset: Asset) => {
    set((state) => ({ currentAsset: asset, playheadTime: 0, seekTarget: null, pendingCueAnchor: null, rehearsalTimeline: null, timeFormat: withoutRehearsalFormat(state.timeFormat) }))
  },

  setCurrentVersion: (version: AssetVersion) => {
    set((state) =>
      state.currentVersion != null && state.currentVersion.id !== version.id
        ? { currentVersion: version, activeAnnotation: null, focusedCommentId: null, pendingCueAnchor: null, rehearsalTimeline: null, timeFormat: withoutRehearsalFormat(state.timeFormat) }
        : { currentVersion: version },
    )
  },

  setPlayheadTime: (time: number) => {
    set({ playheadTime: time })
  },

  seekTo: (time: number, pause?: boolean) => {
    set({ seekTarget: { time, id: Date.now(), pause }, playheadTime: time })
  },

  setFocusedCommentId: (id: string | null) => {
    set({ focusedCommentId: id })
  },

  setPendingAnnotation: (data: Record<string, unknown> | null) => {
    set({ pendingAnnotation: data })
  },

  setActiveAnnotation: (data: Record<string, unknown> | null) => {
    set({ activeAnnotation: data })
  },

  setTimeFormat: (format: TimeFormat) => {
    set({ timeFormat: format })
  },

  toggleDrawingMode: () => {
    set((state) => ({ isDrawingMode: !state.isDrawingMode }))
  },

  setIsDrawingMode: (mode: boolean) => {
    set({ isDrawingMode: mode })
  },

  setDrawingTool: (tool: DrawingTool) => {
    set({ drawingTool: tool })
  },

  setDrawingColor: (color: string) => {
    set({ drawingColor: color })
  },

  setBrushSize: (size: number) => {
    set({ brushSize: size })
  },

  reset: () => {
    set(initialState)
  },
}))
