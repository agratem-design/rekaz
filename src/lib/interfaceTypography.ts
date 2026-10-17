import { ensurePrintFont, printFonts } from '@/print/printSettings'

export const interfaceFonts = printFonts
export type InterfaceTypography = { ui_font_family: string; ui_heading_font_family: string; ui_font_scale: number; ui_primary_color: string; ui_dark_background: string; ui_dark_surface: string; ui_dark_accent: string; ui_light_background: string }
export const defaultInterfaceTypography: InterfaceTypography = { ui_font_family: 'IBM Plex Sans Arabic', ui_heading_font_family: 'Readex Pro', ui_font_scale: 100, ui_primary_color: '#704b32', ui_dark_background: '#151312', ui_dark_surface: '#211c18', ui_dark_accent: '#d1ad7a', ui_light_background: '#f6f2ed' }
export function resolveInterfaceTypography(raw: unknown): InterfaceTypography {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<InterfaceTypography>
  const color = (key: keyof InterfaceTypography) => /^#[0-9a-f]{6}$/i.test(String(value[key] ?? '')) ? String(value[key]) : String(defaultInterfaceTypography[key])
  return {
    ui_primary_color: color('ui_primary_color'), ui_dark_background: color('ui_dark_background'), ui_dark_surface: color('ui_dark_surface'), ui_dark_accent: color('ui_dark_accent'), ui_light_background: color('ui_light_background'),
    ui_font_family: interfaceFonts.includes(value.ui_font_family ?? '') ? value.ui_font_family! : defaultInterfaceTypography.ui_font_family,
    ui_heading_font_family: interfaceFonts.includes(value.ui_heading_font_family ?? '') ? value.ui_heading_font_family! : defaultInterfaceTypography.ui_heading_font_family,
    ui_font_scale: [90, 100, 110, 115].includes(Number(value.ui_font_scale)) ? Number(value.ui_font_scale) : 100,
  }
}
export function applyInterfaceTypography(settings: InterfaceTypography) {
  ensurePrintFont(settings.ui_font_family)
  ensurePrintFont(settings.ui_heading_font_family)
  const root = document.documentElement
  const blend = (a: string,b: string,weight: number) => '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-weight)+parseInt(b.slice(i,i+2),16)*weight).toString(16).padStart(2,'0')).join('')
  const luminance = (color: string) => [1,3,5].reduce((sum,i,j)=>{ const n=parseInt(color.slice(i,i+2),16)/255; return sum+(n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4)*[0.2126,0.7152,0.0722][j] },0)
  const ink = (color: string) => { const light=luminance(color); return (light+0.05)/(luminance('#27221d')+0.05) > 1.05/(light+0.05) ? '#27221d' : '#ffffff' }
  const palette = document.createElement('style')
  palette.dataset.interfacePalette='true'
  const p=settings.ui_primary_color, surface=settings.ui_dark_surface, accent=settings.ui_dark_accent
  const darkInk=ink(surface), muted=blend(darkInk,surface,0.25)
  palette.textContent=`:root{--canvas:${settings.ui_light_background};--color-brand-600:${p};--color-brand-700:${blend(p,'#000000',0.18)};--color-brand-500:${blend(p,'#ffffff',0.12)};--button-ink:${ink(p)};--button-dark-ink:${ink(accent)};--color-sand-400:${accent};--accent:${p}}:root.dark{--canvas:${settings.ui_dark_background};--surface:${surface};--surface-2:${blend(surface,'#ffffff',0.05)};--line:${blend(surface,'#ffffff',0.12)};--line-strong:${blend(surface,'#ffffff',0.25)};--ink:${darkInk};--muted:${muted};--faint:${blend(darkInk,surface,0.38)};--accent:${accent};--accent-soft:${blend(surface,p,0.22)}}`
  document.head.appendChild(palette)
  const old = { body: root.style.getPropertyValue('--font-sans'), heading: root.style.getPropertyValue('--font-display'), size: root.style.fontSize }
  root.style.setProperty('--font-sans', `"${settings.ui_font_family}", system-ui, sans-serif`)
  root.style.setProperty('--font-display', `"${settings.ui_heading_font_family}", system-ui, sans-serif`)
  root.style.fontSize = `${16 * settings.ui_font_scale / 100}px`
  return () => {
    palette.remove()
    for (const [property, value] of [['--font-sans', old.body], ['--font-display', old.heading]]) {
      if (value) root.style.setProperty(property, value); else root.style.removeProperty(property)
    }
    root.style.fontSize = old.size
  }
}
