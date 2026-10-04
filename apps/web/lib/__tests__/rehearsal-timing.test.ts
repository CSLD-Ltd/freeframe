import {describe,it,expect} from 'vitest'
import {sourceLabel,formatSourceLabel,frameSeconds,formatClipTime} from '../rehearsal-timing'
const timeline={frame_count:'200',video_rate:{numerator:'50',denominator:'1'},timecode_rate:{numerator:'25',denominator:'1'},clock_spans:[{id:'a',clip_start:'0',clip_end:'100',source_start:'90000'},{id:'b',clip_start:'120',clip_end:'200',source_start:'95000'}],cues:[]}
describe('rehearsal source timing',()=>{
 it('distinguishes 50 picture frames from 25 LTC labels',()=>{
  expect(sourceLabel(timeline,'20')).toBe('90010')
  expect(sourceLabel(timeline,'21')).toBe('90010')
  expect(formatSourceLabel('90010',timeline.timecode_rate)).toBe('01:00:00:10')
  expect(frameSeconds('20',timeline.video_rate)).toBe(0.4)
  expect(formatClipTime(2.6,timeline.video_rate)).toBe('00:00:02:30')
 })
 it('never extrapolates across a dropout or past exclusive out',()=>{
  expect(sourceLabel(timeline,'119')).toBeNull()
  expect(sourceLabel(timeline,'120')).toBe('95000')
  expect(sourceLabel(timeline,'200')).toBeNull()
 })
 it('preserves half-LTC-frame phase after a 50fps trim',()=>{
  const phased={...timeline,clock_spans:timeline.clock_spans.map(s=>({...s,source_phase:{numerator:'1',denominator:'2'}}))}
  expect(sourceLabel(phased,'21')).toBe('90011')
 })
 it('preserves integers above JavaScript precision',()=>{
  const large={...timeline,clock_spans:[{id:'a',clip_start:'0',clip_end:'100',source_start:'9007199254740993'}]}
  expect(sourceLabel(large,'20')).toBe('9007199254741003')
 })
})
