import {describe,it,expect,vi,beforeEach} from 'vitest'
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react'
import {api} from '@/lib/api'
import {useReviewStore} from '@/stores/review-store'
import {RehearsalTimeline} from '../rehearsal-timeline'
import {CommentInput} from '../comment-input'
vi.mock('@/lib/api',()=>({api:{get:vi.fn()},ApiError:class extends Error{status=404}}))
vi.mock('../review-provider',()=>({useReview:()=>({pauseVideo:vi.fn()})}))
const data={metadata_hash:'a'.repeat(64),timing_verified:false,metadata:{frame_count:'200',video_rate:{numerator:'50',denominator:'1'},timecode_rate:{numerator:'25',denominator:'1'},clock_spans:[{id:'run',clip_start:'0',clip_end:'200',source_start:'90000'}],cues:[{id:'first',clip_frame:'20',clock_span_id:'run',sequence:'1',cue:'12.5',source:'recorded'},{id:'second',clip_frame:'130',clock_span_id:'run',sequence:'1',cue:'12.5',source:'recorded'}]}}
beforeEach(()=>{useReviewStore.getState().reset();useReviewStore.getState().setCurrentVersion({id:'v1',asset_id:'a1'} as any);vi.mocked(api.get).mockResolvedValue(data)})
describe('rehearsal cue lane',()=>{
 it('keeps repeated cues distinct and selects the exact second occurrence',async()=>{
  render(<RehearsalTimeline assetId="a1" currentTime={0.4}/>);
  const buttons=await screen.findAllByRole('button',{name:/Seq 1 · Cue 12.5/});
  expect(buttons).toHaveLength(2);fireEvent.click(buttons[1]);
  expect(useReviewStore.getState().pendingCueAnchor).toMatchObject({cue_occurrence_id:'second',clip_frame:'130',version_id:'v1',seconds:2.6});
  expect(useReviewStore.getState().seekTarget?.pause).toBe(true);
  expect(screen.getByText('Playback timing unverified')).toBeTruthy();
  expect(screen.getAllByText('01:00:00:10')).toHaveLength(2);
 })
 it('view-only links navigate without selecting a comment anchor',async()=>{
  render(<RehearsalTimeline assetId="a1" currentTime={0} canComment={false}/>);
  fireEvent.click((await screen.findAllByRole('button'))[0]);
  expect(useReviewStore.getState().pendingCueAnchor).toBeNull();
 })
 it('clears a pending cue when switching take versions',async()=>{
  render(<RehearsalTimeline assetId="a1" currentTime={0}/>);
  fireEvent.click((await screen.findAllByRole('button'))[0]);
  act(()=>useReviewStore.getState().setCurrentVersion({id:'v2',asset_id:'a1'} as any));
  await waitFor(()=>expect(useReviewStore.getState().pendingCueAnchor).toBeNull());
 })
})

it('preserves a pending drawing and its frame when cue selection is attempted before submit',async()=>{
 const drawing={objects:[{type:'rect',left:10,top:20}]};const saved=vi.fn().mockResolvedValue(undefined)
 useReviewStore.getState().setPendingAnnotation(drawing);useReviewStore.getState().setPlayheadTime(.4)
 render(<><RehearsalTimeline assetId="a1" currentTime={.4}/><CommentInput assetId="a1" projectId="p1" assetType="video" onSubmit={saved}/></>)
 const cue=(await screen.findAllByRole('button',{name:/Seq 1 · Cue 12.5/}))[1];fireEvent.click(cue)
 expect(useReviewStore.getState().pendingCueAnchor).toBeNull();expect(useReviewStore.getState().seekTarget).toBeNull()
 const input=screen.getByPlaceholderText('Leave your comment...');fireEvent.change(input,{target:{value:'Existing drawing'}});fireEvent.keyDown(input,{key:'Enter'})
 await waitFor(()=>expect(saved).toHaveBeenCalledTimes(1));expect(saved.mock.calls[0][1]).toBe(.4);expect(saved.mock.calls[0][3]).toEqual(drawing)
})

it('bounds large cue rendering while allowing navigation through every page',async()=>{
 const cues=Array.from({length:1000},(_,i)=>({...data.metadata.cues[0],id:`cue-${i}`,clip_frame:String(i),cue:String(i)}))
 vi.mocked(api.get).mockResolvedValue({...data,metadata:{...data.metadata,frame_count:'20000',clock_spans:[{...data.metadata.clock_spans[0],clip_end:'20000'}],cues}})
 const {rerender}=render(<RehearsalTimeline assetId="a1" currentTime={0}/>);
 await screen.findByText('Seq 1 · Cue 0')
 expect(screen.getAllByRole('button',{name:/Seq 1 · Cue/}).length).toBeLessThanOrEqual(100)
 fireEvent.click(screen.getByRole('button',{name:'Next cues'}))
 const secondPage=screen.getAllByRole('button',{name:/Seq 1 · Cue/});fireEvent.click(secondPage[0])
 expect(useReviewStore.getState().pendingCueAnchor?.cue_occurrence_id).toBe('cue-100')
 rerender(<RehearsalTimeline assetId="a1" currentTime={1}/>);
 expect(screen.getAllByRole('button',{name:/Seq 1 · Cue/}).length).toBeLessThanOrEqual(100)
 expect(screen.getByRole('button',{name:/Seq 1 · Cue 100/})).toBeTruthy()
})
