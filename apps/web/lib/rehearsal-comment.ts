import {useReviewStore} from '@/stores/review-store'
import type {CueAnchor} from './rehearsal-timing'
interface CueCommentPayload {
 version_id?:string;parent_id?:string;annotation?:unknown;timecode_start?:number;
 clip_frame?:string;cue_occurrence_id?:string;rehearsal_metadata_hash?:string;
}
/** Shared by the project composer and share composer; replies retain their own context. */
export function prepareCueComment<T extends CueCommentPayload>(payload:T,assetId:string,versionId?:string) {
 const anchor=useReviewStore.getState().pendingCueAnchor
 if(!anchor||payload.parent_id||anchor.asset_id!==assetId||anchor.version_id!==versionId)return {payload,anchor:null}
 if(payload.annotation)throw new Error('Finish or discard the drawing before selecting a lighting cue.')
 return {payload:{...payload,version_id:versionId,clip_frame:anchor.clip_frame,cue_occurrence_id:anchor.cue_occurrence_id,rehearsal_metadata_hash:anchor.rehearsal_metadata_hash,timecode_start:anchor.seconds},anchor}
}
export function clearSubmittedCue(anchor:CueAnchor|null) {
 if(anchor&&useReviewStore.getState().pendingCueAnchor===anchor)useReviewStore.getState().setPendingCueAnchor(null)
}
