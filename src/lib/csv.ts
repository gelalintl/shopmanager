export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (value: string | number) => {
    const text = String(value ?? '')
    if (/[;"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
    return text
  }
  const body = [headers, ...rows].map((row) => row.map(escape).join(';')).join('\n')
  const blob = new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
