import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { useReviewStore } from '@/stores/review-store'
import { CommentPanel } from '../comment-panel'

beforeEach(() => {
  useReviewStore.getState().reset()
  Element.prototype.scrollIntoView = vi.fn()
})

const noop = async () => {}

function makeComment(over: Record<string, unknown>) {
  return {
    id: over.id, asset_id: 'a1', version_id: 'v1', parent_id: null,
    author: { id: 'u1', name: 'Maya Chen', avatar_url: null },
    timecode_end: null, resolved: false, visibility: 'public',
    updated_at: new Date().toISOString(),
    replies: [], reactions: [], attachments: [],
    ...over,
  } as never
}

// created 10:00, tc=26 / created 10:30, tc=None / created 11:00, tc=3
const c26 = makeComment({
  id: 'c26', body: 'Comment Alpha tc26',
  timecode_start: 26, created_at: '2026-01-01T10:00:00.000Z',
})
const cNone = makeComment({
  id: 'cNone', body: 'Comment Beta noTc',
  timecode_start: null, created_at: '2026-01-01T10:30:00.000Z',
})
const c3 = makeComment({
  id: 'c3', body: 'Comment Gamma tc3',
  timecode_start: 3, created_at: '2026-01-01T11:00:00.000Z',
})

function renderPanel() {
  return render(
    <CommentPanel
      comments={[c26, cNone, c3]}
      onResolve={noop} onDelete={noop}
      onAddReaction={noop} onRemoveReaction={noop}
      onReply={() => {}}
    />,
  )
}

function bodyOrder() {
  return screen.getAllByText(/^Comment /).map((el) => el.textContent)
}

function openSortMenu() {
  fireEvent.click(screen.getByTitle('Sort'))
}

describe('CommentPanel sort modes', () => {
  it('menu offers Timecode (Default), Oldest, Newest, Commenter, Completed — in that order', () => {
    renderPanel()
    openSortMenu()
    const menu = screen.getByText('Sort thread by...').parentElement as HTMLElement
    const labels = within(menu)
      .getAllByRole('button')
      .map((b) => b.textContent)
    expect(labels).toEqual([
      'Timecode (Default)',
      'Oldest',
      'Newest',
      'Commenter',
      'Completed',
    ])
  })

  it('defaults to timecode order: timecoded ascending, then untimecoded last', () => {
    renderPanel()
    expect(bodyOrder()).toEqual([
      'Comment Gamma tc3',
      'Comment Alpha tc26',
      'Comment Beta noTc',
    ])
  })

  it('"Oldest" sorts by created_at ascending', () => {
    renderPanel()
    openSortMenu()
    fireEvent.click(screen.getByText('Oldest'))
    expect(bodyOrder()).toEqual([
      'Comment Alpha tc26',
      'Comment Beta noTc',
      'Comment Gamma tc3',
    ])
  })

  it('"Newest" sorts by created_at descending', () => {
    renderPanel()
    openSortMenu()
    fireEvent.click(screen.getByText('Newest'))
    expect(bodyOrder()).toEqual([
      'Comment Gamma tc3',
      'Comment Beta noTc',
      'Comment Alpha tc26',
    ])
  })
})


it('shows matching lighting cue context and seeks by its clip frame', () => {
  const response={metadata_hash:'a'.repeat(64),timing_verified:false,metadata:{frame_count:'200',video_rate:{numerator:'50',denominator:'1'},timecode_rate:{numerator:'25',denominator:'1'},clock_spans:[],cues:[{id:'cue-second',clip_frame:'130',clock_span_id:'run',sequence:'1',cue:'12.5',source:'recorded' as const}]}};
  useReviewStore.getState().setRehearsalTimeline({asset_id:'a1',version_id:'v1',response});
  const note=makeComment({id:'cue-note',body:'Cue note',timecode_start:2.6,created_at:'2026-01-01T10:00:00Z',clip_frame:'130',cue_occurrence_id:'cue-second',rehearsal_metadata_hash:'a'.repeat(64)});
  render(<CommentPanel comments={[note]} onResolve={noop} onDelete={noop} onAddReaction={noop} onRemoveReaction={noop} onReply={()=>{}}/>);
  fireEvent.click(screen.getByText('Seq 1 · Cue 12.5 · f130'));
  expect(useReviewStore.getState().seekTarget?.time).toBe(2.6);
});

it('shows source timecode for a saved rehearsal frame while seeking in clip seconds', () => {
  const response={metadata_hash:'a'.repeat(64),timing_verified:false,metadata:{frame_count:'300',video_rate:{numerator:'25',denominator:'1'},timecode_rate:{numerator:'25',denominator:'1'},clock_spans:[{id:'run',clip_start:'104',clip_end:'176',source_start:'90102'}],cues:[]}};
  useReviewStore.getState().setRehearsalTimeline({asset_id:'a1',version_id:'v1',response});
  const note=makeComment({id:'source-note',body:'Source note',timecode_start:4.44,created_at:'2026-01-01T10:00:00Z',clip_frame:'111',rehearsal_metadata_hash:'a'.repeat(64)});
  render(<CommentPanel comments={[note]} onResolve={noop} onDelete={noop} onAddReaction={noop} onRemoveReaction={noop} onReply={()=>{}}/>);
  fireEvent.click(screen.getByText('Source TC 01:00:04:09'));
  expect(useReviewStore.getState().seekTarget?.time).toBe(4.44);
});


it.each([
  {asset_id:'other',version_id:'v1',metadata_hash:'a'.repeat(64)},
  {asset_id:'a1',version_id:'other',metadata_hash:'a'.repeat(64)},
  {asset_id:'a1',version_id:'v1',metadata_hash:'b'.repeat(64)},
])('does not label a comment with another metadata context: %j', context => {
  const response={metadata_hash:context.metadata_hash,timing_verified:false,metadata:{frame_count:'200',video_rate:{numerator:'50',denominator:'1'},timecode_rate:{numerator:'25',denominator:'1'},clock_spans:[],cues:[{id:'cue-second',clip_frame:'130',clock_span_id:'run',sequence:'1',cue:'12.5',source:'recorded' as const}]}};
  useReviewStore.getState().setRehearsalTimeline({asset_id:context.asset_id,version_id:context.version_id,response});
  const note=makeComment({id:'cue-note',body:'Cue note',timecode_start:2.6,created_at:'2026-01-01T10:00:00Z',clip_frame:'130',cue_occurrence_id:'cue-second',rehearsal_metadata_hash:'a'.repeat(64)});
  render(<CommentPanel comments={[note]} onResolve={noop} onDelete={noop} onAddReaction={noop} onRemoveReaction={noop} onReply={()=>{}}/>);
  expect(screen.queryByText('Seq 1 · Cue 12.5 · f130')).toBeNull();
});
