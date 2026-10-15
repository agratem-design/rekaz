// تفقيط المبالغ بالعربية: الدينار الليبي = 1000 درهم
// مثال: 12500.25 → «فقط اثنا عشر ألف وخمسمائة دينار ليبي ومائتان وخمسون درهماً لا غير»

const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة']
const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر']
const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون']
const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة']

// 1..999
function below1000(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  const parts: string[] = []
  if (h) parts.push(hundreds[h])
  if (r) {
    if (r <= 10) parts.push(ones[r])
    else if (r < 20) parts.push(teens[r - 10])
    else {
      const o = r % 10
      parts.push(o ? `${ones[o]} و${tens[Math.floor(r / 10)]}` : tens[Math.floor(r / 10)])
    }
  }
  return parts.join(' و')
}

// اسم المرتبة حسب العدد: ألف/ألفان/آلاف/ألفاً
function scale(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one
  if (n === 2) return two
  const r = n % 100
  if (r >= 3 && r <= 10) return `${below1000(n)} ${few}`
  if (r >= 11 && r <= 99) return `${below1000(n)} ${many}`
  return `${below1000(n)} ${one}`
}

export function numberToArabicWords(value: number): string {
  let n = Math.floor(Math.abs(value))
  if (n === 0) return 'صفر'
  const groups: string[] = []
  const billions = Math.floor(n / 1e9)
  n %= 1e9
  const millions = Math.floor(n / 1e6)
  n %= 1e6
  const thousands = Math.floor(n / 1e3)
  const rest = n % 1e3
  // يتبع العدد اسمُ العملة دائماً، فنستخدم «ألف» لا «ألفاً» كما يُكتب في السندات
  if (billions) groups.push(scale(billions, 'مليار', 'ملياران', 'مليارات', 'مليار'))
  if (millions) groups.push(scale(millions, 'مليون', 'مليونان', 'ملايين', 'مليون'))
  if (thousands) groups.push(scale(thousands, 'ألف', 'ألفان', 'آلاف', 'ألف'))
  if (rest) groups.push(below1000(rest))
  return groups.join(' و')
}

function dinarNoun(n: number): string {
  const r = n % 100
  if (n === 1) return 'دينار ليبي واحد'
  if (n === 2) return 'ديناران ليبيان'
  if (r >= 3 && r <= 10) return `${numberToArabicWords(n)} دنانير ليبية`
  if (r >= 11 && r <= 99) return `${numberToArabicWords(n)} ديناراً ليبياً`
  return `${numberToArabicWords(n)} دينار ليبي`
}

function dirhamNoun(n: number): string {
  const r = n % 100
  if (n === 1) return 'درهم واحد'
  if (n === 2) return 'درهمان'
  if (r >= 3 && r <= 10) return `${numberToArabicWords(n)} دراهم`
  if (r >= 11 && r <= 99) return `${numberToArabicWords(n)} درهماً`
  return `${numberToArabicWords(n)} درهم`
}

export function amountInWords(amount: number): string {
  const abs = Math.abs(Number(amount) || 0)
  const total = Math.round(abs * 1000)
  const dinars = Math.floor(total / 1000)
  const dirhams = total % 1000
  const parts: string[] = []
  if (dinars) parts.push(dinarNoun(dinars))
  if (dirhams) parts.push(dirhamNoun(dirhams))
  if (!parts.length) parts.push('صفر دينار')
  return `فقط ${parts.join(' و')} لا غير`
}
