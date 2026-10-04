"use client";
import {useEffect,useState} from 'react';
import {api,ApiError} from '@/lib/api';
import {frameSeconds,formatSourceLabel,sourceLabel,type RehearsalResponse} from '@/lib/rehearsal-timing';
import {useReviewStore} from '@/stores/review-store';
import {useReview} from './review-provider';
import {useDrawing} from '@/hooks/use-drawing';
const hasDrawing=(data:Record<string,unknown>|null)=>Array.isArray(data?.objects)&&data.objects.length>0;

export function RehearsalTimeline({assetId,currentTime,canComment=true}:{assetId:string;currentTime:number;canComment?:boolean}) {
 const {shareToken,shareSession}=useReview();
 const {currentVersion,setPendingCueAnchor,seekTo,setRehearsalTimeline,isDrawingMode,pendingAnnotation}=useReviewStore();
 const {getJSON}=useDrawing();
 const [drawingBlocked,setDrawingBlocked]=useState(false);
 const pendingDrawing=canComment&&(isDrawingMode||hasDrawing(pendingAnnotation));
 const versionId=currentVersion?.asset_id===assetId?currentVersion.id:null;
 const key=`${assetId}:${versionId}:${shareToken}:${shareSession}`;
 const [result,setResult]=useState<{key:string;data:RehearsalResponse|null;error?:string}|null>(null);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!versionId)return;
  let ignore=false;
  const path=shareToken?`/share/${encodeURIComponent(shareToken)}/assets/${assetId}/versions/${versionId}/rehearsal-metadata${shareSession?`?share_session=${encodeURIComponent(shareSession)}`:''}`:`/assets/${assetId}/versions/${versionId}/rehearsal-metadata`;
  api.get<RehearsalResponse>(path).then(data=>{if(!ignore){setResult({key,data});if(data?.metadata?.video_rate)setRehearsalTimeline({asset_id:assetId,version_id:versionId,response:data})}}).catch(e=>{if(!ignore)setResult({key,data:null,error:e instanceof ApiError&&e.status===404?undefined:'Rehearsal timeline unavailable'})});
  return()=>{ignore=true};
 },[assetId,versionId,shareToken,shareSession,key,retry]);
 if(result?.key!==key)return null;
 if(result.error)return <div className="px-4 py-2 text-xs text-text-secondary">{result.error} <button className="text-accent underline" onClick={()=>setRetry(n=>n+1)}>Retry</button></div>;
 if(!result.data)return null;
 const {metadata:m,metadata_hash:hash,timing_verified:verified}=result.data;
 const frame=Math.max(0,Math.floor(currentTime*Number(m.video_rate.numerator)/Number(m.video_rate.denominator)+1e-7)).toString();
 const label=sourceLabel(m,frame);
 return <section aria-label="Rehearsal source timeline" className="shrink-0 border-t border-border bg-bg-secondary px-4 py-2">
  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
   <span className="text-text-secondary">Source TC <span className="ml-2 font-mono tabular-nums text-text-primary">{label===null?'Unmapped':formatSourceLabel(label,m.timecode_rate)}</span></span>
   <span className="text-text-tertiary">{verified?'Timing verified':'Playback timing unverified'}</span>
  </div>
  {m.cues.length>0?<div className="mt-2 flex gap-1 overflow-x-auto pb-1" aria-label="Lighting cue occurrences">
   {m.cues.map(c=>{const seconds=frameSeconds(c.clip_frame,m.video_rate);return <button key={c.id}
    className="shrink-0 rounded px-2 py-1 text-xs text-text-secondary hover:bg-bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    disabled={pendingDrawing}
    title={`${canComment?'Comment on':'Go to'} sequence ${c.sequence}, cue ${c.cue}, clip frame ${c.clip_frame}`}
    onClick={()=>{const draft=useReviewStore.getState();if(canComment&&(draft.isDrawingMode||hasDrawing(draft.pendingAnnotation)||hasDrawing(getJSON()))){setDrawingBlocked(true);return}setDrawingBlocked(false);seekTo(seconds,true);if(canComment&&versionId)setPendingCueAnchor({asset_id:assetId,version_id:versionId,clip_frame:c.clip_frame,cue_occurrence_id:c.id,rehearsal_metadata_hash:hash,label:`Seq ${c.sequence} · Cue ${c.cue}${c.source==='simulated'?' (simulated)':''}`,seconds})}}>
    <span className="font-medium">Seq {c.sequence} · Cue {c.cue}</span><span className="ml-2 font-mono text-text-tertiary">{formatSourceLabel(sourceLabel(m,c.clip_frame)!,m.timecode_rate)}</span>{c.source==='simulated'&&<span className="ml-1">Simulated</span>}
   </button>})}
  </div>:<p className="mt-1 text-xs text-text-tertiary">No recorded lighting cues for this take.</p>}
  {(pendingDrawing||drawingBlocked)&&<p role="status" className="mt-1 text-xs text-text-secondary">Finish or discard your drawing before choosing a lighting cue.</p>}
 </section>;
}
