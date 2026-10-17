import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'

function compatible(value: unknown, sample: unknown): boolean {
 if (sample === null) return value === null || typeof value === 'string'
 if (Array.isArray(sample)) return Array.isArray(value) && value.length <= 1000 && (!sample.length || value.every((entry) => compatible(entry,sample[0])))
 if (sample !== null && typeof sample === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.entries(sample).every(([key,v]) => compatible((value as Record<string,unknown>)[key],v))
 return typeof value === typeof sample
}

export function useAutomaticDraft<T>(scope:string,open:boolean,payload:T,dirty:boolean,restore:(saved:T)=>void) {
 const {profile}=useAuth()
 const key=`rekaz-draft-v1:${profile?.id??'anonymous'}:${scope}`
 const previous=useRef({open:false,key})
 const [status,setStatus]=useState<'saved'|'restored'|'unavailable'|''>('')
 useEffect(()=>{
  const clear=()=>{try{localStorage.removeItem(key)}catch{/* unavailable */}}
  if(!open){if(previous.current.open&&previous.current.key===key)clear();previous.current={open:false,key};return}
  if(!previous.current.open||previous.current.key!==key){
   previous.current={open:true,key}
   try{const saved=JSON.parse(localStorage.getItem(key)??'null')?.value;if(compatible(saved,payload)){restore(saved);setStatus('restored')}else setStatus('')}
   catch{setStatus('unavailable')}
   return
  }
  if(!dirty){clear();setStatus('');return}
  try{localStorage.setItem(key,JSON.stringify({saved_at:new Date().toISOString(),value:payload}));setStatus(s=>s==='restored'?s:'saved')}
  catch{setStatus('unavailable')}
 },[key,open,payload,dirty]) // eslint-disable-line react-hooks/exhaustive-deps
 return status
}
export function useDraftState<T>(scope: string, initial: T) {
 const { profile } = useAuth()
 const key = `rekaz-draft-v1:${profile?.id ?? 'anonymous'}:${scope}`
 const [restored] = useState(() => {
  try { const saved = JSON.parse(localStorage.getItem(key) ?? 'null'); return compatible(saved?.value,initial) ? saved.value as T : null } catch { return null }
 })
 const [value, setValue] = useState<T>(() => restored ?? initial)
 const [storageError, setStorageError] = useState(false)
 const initialText = useRef(JSON.stringify(initial))
 const suppress = useRef(false)
 useEffect(() => {
  if (suppress.current || (restored === null && JSON.stringify(value) === initialText.current)) return
  try { localStorage.setItem(key,JSON.stringify({saved_at:new Date().toISOString(),value})); setStorageError(false) } catch { setStorageError(true) }
 },[key,value,restored])
 const update: typeof setValue = useCallback((next) => { suppress.current=false; setValue(next) },[])
 const clear = useCallback(() => { suppress.current=true; try { localStorage.removeItem(key) } catch { /* storage unavailable */ } },[key])
 return { value, setValue:update, clear, restored:restored!==null, storageError }
}

// Existing forms hydrate explicitly on opening; keys include user, project and transaction kind.
export function useFormDraft<T>(scope: string) {
 const { profile } = useAuth()
 const key=`rekaz-draft-v1:${profile?.id ?? 'anonymous'}:${scope}`
 return {
  load: (sample:T):T|null => { try {const v=JSON.parse(localStorage.getItem(key)??'null')?.value;return compatible(v,sample)?v as T:null} catch {return null} },
  save: (value:T) => { try {localStorage.setItem(key,JSON.stringify({saved_at:new Date().toISOString(),value}));return true} catch {return false} },
  clear: () => {try {localStorage.removeItem(key)} catch { /* storage unavailable */ }},
 }
}
