import { useEffect, useState } from 'react'

function initial() {
  try {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
  } catch {
    /* التخزين غير متاح */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// تطبيق المظهر المحفوظ فور التحميل، حتى في صفحة الدخول
document.documentElement.classList.toggle('dark', initial())

export function useTheme() {
  const [dark, setDark] = useState(initial)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light')
    } catch {
      /* التخزين غير متاح */
    }
  }, [dark])
  return { dark, toggle: () => setDark((d) => !d) }
}
