import { format, differenceInDays, parseISO } from 'date-fns'

export function formatDate(date) {
  if (!date) return '—'
  return format(typeof date === 'string' ? parseISO(date) : date, 'dd MMM yyyy')
}

export function formatDateShort(date) {
  if (!date) return '—'
  return format(typeof date === 'string' ? parseISO(date) : date, 'dd/MM/yy')
}

export function daysUntil(date) {
  if (!date) return null
  return differenceInDays(typeof date === 'string' ? parseISO(date) : date, new Date())
}

export function currentFY() {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `${year}-${String(year + 1).slice(2)}`
}

export function fyStart(fy) {
  const year = parseInt(fy.split('-')[0])
  return new Date(year, 3, 1) // April 1
}

export function fyEnd(fy) {
  const year = parseInt(fy.split('-')[0]) + 1
  return new Date(year, 2, 31) // March 31
}
