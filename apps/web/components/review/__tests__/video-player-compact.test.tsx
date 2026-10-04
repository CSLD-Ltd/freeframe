import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(async () => ({ data: {} })) } }))
vi.mock('../review-provider', () => ({ useReview: () => ({ registerPauseHandler: () => {} }) }))
const quality = vi.hoisted(() => ({
  levels: [] as { index: number; label: string; height: number; bitrate: number }[],
  current: -1,
  time: 0,
  set: vi.fn(),
}))

vi.mock('@/hooks/use-video-player', () => ({
  useVideoPlayer: () => ({
    videoRef: { current: null }, hlsRef: { current: null },
    isPlaying: false, currentTime: quality.time, duration: 100, buffered: 0,
    volume: 1, isMuted: false, playbackRate: 1,
    qualityLevels: quality.levels, currentQuality: quality.current, isLoading: false, isFullscreen: false, error: null,
    pause: () => {}, togglePlay: () => {}, seek: () => {}, setPlaybackRate: () => {},
    setQuality: quality.set, setVolume: () => {}, toggleMute: () => {}, toggleFullscreen: () => {},
  }),
}))

import { VideoPlayer } from '../video-player'
import { useReviewStore } from '@/stores/review-store'
vi.mock('../rehearsal-timeline', () => ({ RehearsalTimeline: () => null }))

/**
 * `use-media-query` caches each MediaQueryList at module scope, which is right
 * in a browser because a real list is live, but means a stub returning a frozen
 * `matches` would be read once and reused for the rest of the file. So this
 * returns a list whose `matches` is a getter over a mutable width.
 */
let width = 1024
function stubWidth(px: number) { width = px }

vi.stubGlobal('matchMedia', (query: string) => {
  const m = query.match(/min-width:\s*(\d+)px/)
  return {
    get matches() { return m ? width >= Number(m[1]) : false },
    media: query, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  }
})

beforeEach(() => {
  useReviewStore.getState().reset()
  quality.time = 0
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  quality.levels = []
  quality.current = -1
})

const props = { assetId: 'a1', versionId: 'v1', comments: [], initialStreamUrl: 'x.m3u8' } as unknown as React.ComponentProps<typeof VideoPlayer>

describe('the transport row below sm', () => {
  it('moves loop, speed and mute behind an overflow menu on a phone', () => {
    stubWidth(390)
    render(<VideoPlayer {...props} />)

    expect(screen.getByLabelText('More controls')).toBeTruthy()
    // The three that moved. Their inline buttons must be gone, not merely
    // hidden, or a screen reader still reaches two of each.
    expect(screen.queryByLabelText('Loop')).toBeNull()
    expect(screen.queryByLabelText('Playback speed')).toBeNull()
    expect(screen.queryByLabelText('Mute')).toBeNull()
  })

  it('keeps every control inline above sm, with no overflow menu', () => {
    stubWidth(1024)
    render(<VideoPlayer {...props} />)

    expect(screen.queryByLabelText('More controls')).toBeNull()
    expect(screen.getByLabelText('Loop')).toBeTruthy()
    expect(screen.getByLabelText('Playback speed')).toBeTruthy()
  })

  it('gives the play button a 44px target when compact and 28px when not', () => {
    stubWidth(390)
    const { unmount } = render(<VideoPlayer {...props} />)
    expect(screen.getByLabelText('Play').className).toContain('h-11')
    unmount()

    stubWidth(1024)
    render(<VideoPlayer {...props} />)
    expect(screen.getByLabelText('Play').className).toContain('h-7')
  })

  it('gives the fullscreen button the same 44px target when compact, and 28px when not', () => {
    stubWidth(390)
    const { unmount } = render(<VideoPlayer {...props} />)
    const compactClasses = screen.getByLabelText('Enter fullscreen').className.split(/\s+/)
    expect(compactClasses).toContain('h-11')
    expect(compactClasses).toContain('w-11')
    unmount()

    stubWidth(1024)
    render(<VideoPlayer {...props} />)
    const wideClasses = screen.getByLabelText('Enter fullscreen').className.split(/\s+/)
    expect(wideClasses).toContain('h-7')
    expect(wideClasses).toContain('w-7')
  })
})

describe('the quality selector', () => {
  const ladder = [
    { index: 0, label: '1080p', height: 1080, bitrate: 5_000_000 },
    { index: 1, label: '720p', height: 720, bitrate: 2_500_000 },
  ]

  it('is not inline in the compact row, which has no room for it at 360px', () => {
    quality.levels = ladder
    stubWidth(360)
    render(<VideoPlayer {...props} />)

    expect(screen.queryByRole('combobox', { name: 'Quality' })).toBeNull()
  })

  it('lists every rung, plus Auto, as 44px rows in the overflow menu', () => {
    quality.levels = ladder
    stubWidth(360)
    render(<VideoPlayer {...props} />)

    fireEvent.click(screen.getByLabelText('More controls'))
    const row = screen.getByRole('button', { name: /^Quality/ })
    // Closed until asked for, so the menu stays short.
    expect(screen.queryByLabelText('Quality 720p')).toBeNull()

    fireEvent.click(row)
    for (const label of ['Auto', '1080p', '720p']) {
      expect(screen.getByLabelText(`Quality ${label}`).className.split(/\s+/)).toContain('h-11')
    }

    fireEvent.click(screen.getByLabelText('Quality 720p'))
    expect(quality.set).toHaveBeenCalledWith(1)
    // Picking a rung closes the menu, like the other overflow rows.
    expect(screen.queryByLabelText('Quality 1080p')).toBeNull()
  })

  it('swaps the menu rows for the rung list instead of appending to it', () => {
    // The menu opens upward from a transport row that sits only ~190-245px
    // below the top of the player on a portrait phone. Four 44px rows fit
    // there; appending the list to Loop, Speed, Mute and Quality made eight and
    // ran the top of the menu under the page header, out of reach.
    quality.levels = ladder
    stubWidth(360)
    render(<VideoPlayer {...props} />)

    fireEvent.click(screen.getByLabelText('More controls'))
    for (const name of [/^Loop/, /^Speed/, /^Mute/, /^Quality/]) {
      expect(screen.queryByRole('button', { name })).not.toBeNull()
    }

    fireEvent.click(screen.getByRole('button', { name: /^Quality/ }))
    for (const name of [/^Loop/, /^Speed/, /^Mute/]) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
    // Auto plus each rung, and nothing else in the menu: this is also what
    // shows the Quality row itself has gone, since its name and the Auto
    // row's are both "Quality Auto".
    const menu = screen.getByLabelText('Quality Auto').parentElement as HTMLElement
    expect(Array.from(menu.querySelectorAll('button')).map((b) => b.getAttribute('aria-label')))
      .toEqual(['Quality Auto', 'Quality 1080p', 'Quality 720p'])
  })

  it('stays an inline select above sm, with no overflow menu', () => {
    quality.levels = ladder
    stubWidth(1024)
    render(<VideoPlayer {...props} />)

    expect(screen.getByRole('combobox', { name: 'Quality' })).toBeTruthy()
    expect(screen.queryByLabelText('More controls')).toBeNull()
  })

  it('has no Quality row in the overflow menu when there is no ladder', () => {
    stubWidth(360)
    render(<VideoPlayer {...props} />)

    fireEvent.click(screen.getByLabelText('More controls'))
    expect(screen.queryByRole('button', { name: /^Quality/ })).toBeNull()
  })
})

describe('the stage on a touch screen', () => {
  it('sets touch-action: manipulation, so a tap on the picture is a tap and not the start of a double-tap zoom', () => {
    const { container } = render(<VideoPlayer {...props} />)
    // The stage is the click target around the <video>: a tap on it toggles play.
    const stage = container.querySelector('video')?.parentElement
    expect(stage?.className.split(/\s+/)).toContain('touch-manipulation')
  })
})

const rehearsal = { metadata_hash: 'a'.repeat(64), timing_verified: false, metadata: {
  frame_count: '300', video_rate: {numerator:'25',denominator:'1'}, timecode_rate: {numerator:'25',denominator:'1'},
  clock_spans:[{id:'run',clip_start:'104',clip_end:'176',source_start:'90102'}],cues:[],
}}
function setRehearsal() {
  useReviewStore.setState({currentVersion:{id:'v1',asset_id:'a1'} as any, rehearsalTimeline:{asset_id:'a1',version_id:'v1',response:rehearsal}})
}
describe('source timecode transport',()=>{
  it('shows the same source timecode as the rehearsal mapping by default',()=>{
    setRehearsal(); quality.time=4.44
    render(<VideoPlayer {...props}/>)
    expect(screen.getByText('01:00:04:09')).toBeTruthy()
    expect(screen.queryByText('00:00:04:11')).toBeNull()
  })
  it('labels an explicit clip clock separately and keeps source mode unmapped in gaps',()=>{
    setRehearsal();quality.time=4
    render(<VideoPlayer {...props}/>)
    expect(screen.getByText('Unmapped')).toBeTruthy()
    fireEvent.click(screen.getByText('Unmapped'))
    fireEvent.click(screen.getByText('Clip timecode'))
    expect(screen.getByText('Clip TC')).toBeTruthy()
    expect(screen.getByText('00:00:04:00')).toBeTruthy()
  })
  it('updates the comment playhead on every seek, even within the previous 100ms throttle',()=>{
    vi.spyOn(Date,'now').mockReturnValue(1000)
    quality.time=4.44
    const view=render(<VideoPlayer {...props}/>)
    quality.time=5.64
    view.rerender(<VideoPlayer {...props}/>)
    expect(useReviewStore.getState().playheadTime).toBe(5.64)
    vi.restoreAllMocks()
  })
})


it.each([{numerator:'25',denominator:'1'},{numerator:'50',denominator:'1'}])('uses the shared frame projection in transport Frames mode at %j', rate=>{
  setRehearsal()
  useReviewStore.setState({timeFormat:'frames',rehearsalTimeline:{asset_id:'a1',version_id:'v1',response:{...rehearsal,metadata:{...rehearsal.metadata,video_rate:rate}}}})
  quality.time=201*Number(rate.denominator)/Number(rate.numerator)-0.000001
  render(<VideoPlayer {...props}/>)
  expect(screen.getByRole('button',{name:`201 / ${100*Number(rate.numerator)/Number(rate.denominator)}`})).toBeTruthy()
})
