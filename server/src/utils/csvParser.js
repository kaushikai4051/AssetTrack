const { parse } = require('csv-parse/sync')

function parseCSVBuffer(buffer) {
  const text = buffer.toString('utf-8').replace(/^﻿/, '') // strip Excel BOM
  return parse(text, {
    columns: (header) => header.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_')),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  })
}

// Accepts YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY
function parseDate(val) {
  if (!val) return null
  let str = String(val).trim()
  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (dmy) str = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  const d = new Date(str)
  return isNaN(d) ? null : d.toISOString().slice(0, 10)
}

function parseNum(val) {
  if (val === '' || val == null) return null
  const n = parseFloat(String(val).replace(/,/g, ''))
  return isNaN(n) ? null : n
}

function parseBool(val) {
  if (!val) return false
  return ['yes', 'true', '1', 'y'].includes(String(val).toLowerCase().trim())
}

module.exports = { parseCSVBuffer, parseDate, parseNum, parseBool }
