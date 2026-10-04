import {beforeEach,expect,it,vi} from 'vitest'
import {renderHook,act} from '@testing-library/react'
import {useComments} from '../use-comments'
import {api} from '@/lib/api'
import {useReviewStore} from '@/stores/review-store'
vi.mock('@/lib/api',()=>({api:{get:vi.fn(async()=>[]),post:vi.fn()}}))
const anchor={asset_id:'asset',version_id:'version',clip_frame:'130',cue_occurrence_id:'repeat-2',rehearsal_metadata_hash:'a'.repeat(64),label:'Cue 12.5',seconds:2.6}
beforeEach(()=>{vi.clearAllMocks();useReviewStore.getState().reset();useReviewStore.getState().setPendingCueAnchor(anchor);vi.mocked(api.post).mockResolvedValue({id:'comment',replies:[]})})
it('authenticated composer posts the exact selected cue and clears it after success',async()=>{
 const {result}=renderHook(()=>useComments('asset','version'))
 await act(async()=>{await result.current.createComment('Reduce intensity',2.60001)})
 expect(api.post).toHaveBeenCalledWith('/assets/asset/comments',expect.objectContaining({version_id:'version',clip_frame:'130',cue_occurrence_id:'repeat-2',rehearsal_metadata_hash:'a'.repeat(64),timecode_start:2.6}))
 expect(useReviewStore.getState().pendingCueAnchor).toBeNull()
})
it('failed submission preserves the selected cue for retry',async()=>{
 vi.mocked(api.post).mockRejectedValue(new Error('Offline'))
 const {result}=renderHook(()=>useComments('asset','version'))
 await expect(result.current.createComment('Retry')).rejects.toThrow('Offline')
 expect(useReviewStore.getState().pendingCueAnchor).toEqual(anchor)
})
it('reply submission does not consume an unrelated pending top-level cue',async()=>{
 const {result}=renderHook(()=>useComments('asset','version'))
 await act(async()=>{await result.current.createComment('Reply',undefined,undefined,undefined,'parent')})
 expect(api.post).toHaveBeenCalledWith('/assets/asset/comments/parent/replies',{body:'Reply',version_id:'version',parent_id:'parent'})
 expect(useReviewStore.getState().pendingCueAnchor).toEqual(anchor)
})
it('does not inject an anchor from another version',async()=>{
 const {result}=renderHook(()=>useComments('asset','other-version'))
 await act(async()=>{await result.current.createComment('New version')})
 expect(api.post).toHaveBeenCalledWith('/assets/asset/comments',{body:'New version',version_id:'other-version'})
 expect(useReviewStore.getState().pendingCueAnchor).toEqual(anchor)
})
it('conflicting drawing and cue cannot silently lose either attachment',async()=>{
 const {result}=renderHook(()=>useComments('asset','version'))
 await expect(result.current.createComment('Drawing',undefined,undefined,{objects:[{}]})).rejects.toThrow(/drawing/)
 expect(api.post).not.toHaveBeenCalled()
})
