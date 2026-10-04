export interface ExactRate {numerator:string;denominator:string}
export interface RehearsalCue {id:string;clip_frame:string;clock_span_id:string;sequence:string;cue:string;data_pool?:string|null;source:'recorded'|'simulated'}
export interface RehearsalTimeline {
 frame_count:string;video_rate:ExactRate;timecode_rate:ExactRate;
 clock_spans:{id:string;clip_start:string;clip_end:string;source_start:string;source_phase?:ExactRate}[];
 cues:RehearsalCue[];
}
export interface RehearsalResponse {metadata_hash:string;metadata:RehearsalTimeline;timing_verified:boolean}
export interface CueAnchor {asset_id:string;version_id:string;clip_frame:string;cue_occurrence_id:string;rehearsal_metadata_hash:string;label:string;seconds:number}
export function sourceLabel(timeline:RehearsalTimeline,frame:string):string|null {
 const f=BigInt(frame)
 const span=timeline.clock_spans.find(s=>BigInt(s.clip_start)<=f&&f<BigInt(s.clip_end))
 if(!span)return null
 const phase=span.source_phase??{numerator:'0',denominator:'1'};
 const n=(f-BigInt(span.clip_start))*BigInt(timeline.timecode_rate.numerator)*BigInt(timeline.video_rate.denominator);
 const d=BigInt(timeline.timecode_rate.denominator)*BigInt(timeline.video_rate.numerator);
 const offset=(n*BigInt(phase.denominator)+BigInt(phase.numerator)*d)/(d*BigInt(phase.denominator));
 return (BigInt(span.source_start)+offset).toString()
}
export function formatSourceLabel(frame:string,rate:ExactRate):string {
 const fps=BigInt(rate.numerator)/BigInt(rate.denominator),f=BigInt(frame)
 const seconds=f/fps
 const pad=(n:bigint)=>n.toString().padStart(2,'0')
 return `${pad(seconds/BigInt(3600)%BigInt(24))}:${pad(seconds/BigInt(60)%BigInt(60))}:${pad(seconds%BigInt(60))}:${pad(f%fps)}`
}
export function frameSeconds(frame:string,rate:ExactRate):number {return Number(frame)*Number(rate.denominator)/Number(rate.numerator)}

export function formatClipTime(seconds:number,rate:ExactRate):string {
 const frames=BigInt(Math.max(0,Math.floor(seconds*Number(rate.numerator)/Number(rate.denominator)+1e-7)));
 const nominal=(BigInt(rate.numerator)+BigInt(rate.denominator)-BigInt(1))/BigInt(rate.denominator);
 return formatSourceLabel(frames.toString(),{numerator:nominal.toString(),denominator:'1'});
}

/** One clip-frame projection shared by transport, source strip and comment labels. */
export function clipFrameAt(seconds:number,rate:ExactRate):string {
 return Math.max(0,Math.floor(seconds*Number(rate.numerator)/Number(rate.denominator)+1e-7)).toString();
}
export function formatSourceTime(seconds:number,timeline:RehearsalTimeline):string {
 const label=sourceLabel(timeline,clipFrameAt(seconds,timeline.video_rate));
 return label===null?'Unmapped':formatSourceLabel(label,timeline.timecode_rate);
}
