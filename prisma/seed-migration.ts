import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  CustomerKind,
  InvoiceStatus,
  MovementType,
  PaymentMethod,
  PrismaClient,
  UserRole,
  type EstimationStatus,
} from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const DUMP_PATH = path.join(__dirname, 'data-dump.sql')
const MAGIC_CUSTOMER_ID = 1

const CUSTOMER_COLUMNS = [
  'id',
  'customer_type_id',
  'name',
  'post_box',
  'email',
  'number',
  'nif',
  'address',
  'user_id',
  'create_date',
]
const PRODUCT_COLUMNS = [
  'id',
  'code',
  'designation',
  'unit_price',
  'user_id',
  'create_date',
  'deleted',
  'erase_user_id',
]
const ESTIMATION_COLUMNS = [
  'id',
  'customer_id',
  'user_id',
  'code',
  'tva',
  'warranty',
  'famount',
  'fiscal_year',
  'state',
  'create_date',
  'update_date',
  'update_user_id',
  'erase_user_id',
]
const OPERATION_COLUMNS = [
  'id',
  'operation_type_id',
  'product_id',
  'user_id',
  'estimation_id',
  'customer_id',
  'create_date',
  'selling_price',
  'quantity',
  'deleted',
  'erase_user_id',
]
const INVOICE_COLUMNS = [
  'id',
  'code',
  'user_id',
  'estimation_id',
  'customer_id',
  'create_date',
  'fiscal_year',
  'state',
  'erase_user_id',
]
const COLLECTION_COLUMNS = ['id', 'invoice_id', 'user_id', 'amount', 'create_date']
const COMPANY_COLUMNS = [
  'id',
  'name',
  'post_box',
  'email',
  'address',
  'nif',
  'slogan',
  'logo_path',
  'number1',
  'number2',
]

type SqlRow = Record<string, unknown>

function asString(value: unknown, fallback = '') {
  if (value == null) return fallback
  const text = String(value)
  return text.toUpperCase() === 'NULL' ? fallback : text
}

function asNullableString(value: unknown) {
  const text = asString(value).trim()
  return text ? text : null
}

function asPhone(value: unknown) {
  const text = asNullableString(value)
  return text && text !== '0' ? text : null
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const n = Number(String(value ?? '').replace(/\s/g, ''))
  return Number.isFinite(n) ? n : fallback
}

function asBigInt(value: unknown) {
  return BigInt(Math.round(asNumber(value, 0)))
}

function asBool(value: unknown) {
  if (typeof value === 'boolean') return value
  const raw = String(value ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 't'
}

function asDate(value: unknown, fallback = new Date()) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (value == null) return fallback
  const parsed = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function firstDigits(code: string) {
  const match = code.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

function formatImportedCode(kind: 'ESTIMATION' | 'INVOICE', fiscalYear: number, raw: string) {
  const trimmed = raw.trim()
  if (/^(DEV|FAC)-/i.test(trimmed)) return trimmed.toUpperCase()
  const n = firstDigits(trimmed)
  if (!n) return trimmed
  const prefix = kind === 'INVOICE' ? 'FAC' : 'DEV'
  return `${prefix}-${fiscalYear}-${String(n).padStart(4, '0')}`
}

function sequenceValueFromCode(code: string) {
  const parts = code.split('-')
  const tail = parts[parts.length - 1] ?? code
  const n = parseInt(tail.replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? n : firstDigits(code)
}

function invoiceStatusFromPaid(paid: number, totalTtc: number): InvoiceStatus {
  if (paid <= 0) return InvoiceStatus.UNPAID
  if (paid >= totalTtc) return InvoiceStatus.PAID
  return InvoiceStatus.PARTIALLY_PAID
}

function mapEstimationStatus(state: unknown, hasInvoice: boolean): EstimationStatus {
  const raw = asString(state).trim().toUpperCase().replace(/\s+/g, '_')
  if (raw === 'CANCELED' || raw === 'CANCELLED') return 'CANCELED'
  if (hasInvoice || raw === 'VALIDATED' || raw === 'INVOICED') return 'INVOICED'
  if (raw === 'SENT') return 'SENT'
  if (raw === 'ACCEPTED') return 'ACCEPTED'
  if (raw === 'REJECTED') return 'REJECTED'
  if (raw === 'DRAFT') return 'DRAFT'
  return 'ON_GOING'
}

function unescapeMysql(text: string) {
  return text
    .replace(/\\0/g, '\0')
    .replace(/\\b/g, '\b')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\Z/g, '\x1a')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

function parseSqlScalar(raw: string): unknown {
  const value = raw.trim()
  if (!value || /^null$/i.test(value)) return null
  if (/^true$/i.test(value)) return true
  if (/^false$/i.test(value)) return false
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return unescapeMysql(value.slice(1, -1).replace(/''/g, "'"))
  }
  const n = Number(value)
  if (value !== '' && Number.isFinite(n)) return n
  return value
}

function splitSqlArgs(body: string) {
  const parts: string[] = []
  let current = ''
  let quote: "'" | '"' | null = null
  let escaped = false
  for (const char of body) {
    if (quote) {
      current += char
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      current += char
      continue
    }
    if (char === ',') {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

function parseValueTuples(valuesSql: string): unknown[][] {
  const tuples: unknown[][] = []
  let depth = 0
  let quote: "'" | '"' | null = null
  let escaped = false
  let tuple = ''
  for (const char of valuesSql) {
    if (quote) {
      tuple += char
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      if (depth > 0) tuple += char
      continue
    }
    if (char === '(') {
      depth += 1
      if (depth === 1) {
        tuple = ''
        continue
      }
    }
    if (char === ')') {
      depth -= 1
      if (depth === 0) {
        tuples.push(splitSqlArgs(tuple).map(parseSqlScalar))
        tuple = ''
        continue
      }
    }
    if (depth > 0) tuple += char
  }
  return tuples
}

function readInsertRows(sql: string, table: string, fallbackColumns: string[]): SqlRow[] {
  const rows: SqlRow[] = []
  const header = new RegExp(
    `INSERT\\s+(?:IGNORE\\s+)?INTO\\s+(?:\`?\\w+\`?\\.)?\`?${table}\`?\\s*(\\(([^)]*)\\))?\\s*VALUES`,
    'gi',
  )
  let match: RegExpExecArray | null
  while ((match = header.exec(sql))) {
    const columns = match[2]
      ? match[2]
          .split(',')
          .map((column) => column.replace(/[`"'\s]/g, '').toLowerCase())
          .filter(Boolean)
      : fallbackColumns
    let index = header.lastIndex
    while (index < sql.length && /\s/.test(sql[index])) index += 1
    let quote: "'" | '"' | null = null
    let escaped = false
    let end = index
    for (; end < sql.length; end += 1) {
      const char = sql[end]
      if (quote) {
        if (escaped) {
          escaped = false
          continue
        }
        if (char === '\\') {
          escaped = true
          continue
        }
        if (char === quote) quote = null
        continue
      }
      if (char === "'" || char === '"') {
        quote = char
        continue
      }
      if (char === ';') break
    }
    const tuples = parseValueTuples(sql.slice(index, end))
    for (const tuple of tuples) {
      const row: SqlRow = {}
      columns.forEach((column, columnIndex) => {
        row[column] = tuple[columnIndex] ?? null
      })
      rows.push(row)
    }
    header.lastIndex = end + 1
  }
  return rows
}

function stripSqlComments(sql: string) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '\n')
    .replace(/^[ \t]*--[^\n]*$/gm, '')
    .replace(/^[ \t]*#[^\n]*$/gm, '')
}

async function resetSequence(table: string, column = 'id') {
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"${table}"', '${column}'), COALESCE((SELECT MAX("${column}") FROM "${table}"), 1), true)`,
  )
}

async function ensureYearSequences(
  companyId: number,
  fiscalYear: number,
  lastEst?: number,
  lastInv?: number,
) {
  await prisma.documentSequence.upsert({
    where: { companyId_fiscalYear_type: { companyId, fiscalYear, type: 'ESTIMATION' } },
    update: lastEst == null ? {} : { lastValue: lastEst },
    create: { companyId, fiscalYear, type: 'ESTIMATION', lastValue: lastEst ?? 0 },
  })
  await prisma.documentSequence.upsert({
    where: { companyId_fiscalYear_type: { companyId, fiscalYear, type: 'INVOICE' } },
    update: lastInv == null ? {} : { lastValue: lastInv },
    create: { companyId, fiscalYear, type: 'INVOICE', lastValue: lastInv ?? 0 },
  })
}

async function main() {
  console.log('Seed migration MySQL → PostgreSQL')

  const company = await prisma.company.upsert({
    where: { id: 1 },
    update: {
      name: 'ELTEK',
      slogan: 'ShopManager',
      isActive: true,
    },
    create: {
      id: 1,
      name: 'ELTEK',
      slogan: 'ShopManager',
      address: 'Niamey',
      phone1: '00000000',
      isActive: true,
    },
  })

  const operatorHash = await bcrypt.hash('Opérateur2026!', 10)
  const directorHash = await bcrypt.hash('Directeur2026!', 10)
  const techHash = await bcrypt.hash('SuperAdmin2026!', 10)

  const operator = await prisma.user.upsert({
    where: { companyId_pseudo: { companyId: company.id, pseudo: 'operateur' } },
    update: { password: operatorHash, role: UserRole.USER, name: 'Opérateur', isDeleted: false },
    create: {
      companyId: company.id,
      name: 'Opérateur',
      pseudo: 'operateur',
      password: operatorHash,
      role: UserRole.USER,
    },
  })
  const director = await prisma.user.upsert({
    where: { companyId_pseudo: { companyId: company.id, pseudo: 'directeur' } },
    update: { password: directorHash, role: UserRole.ADMIN, name: 'Directeur', isDeleted: false },
    create: {
      companyId: company.id,
      name: 'Directeur',
      pseudo: 'directeur',
      password: directorHash,
      role: UserRole.ADMIN,
    },
  })
  const technician = await prisma.user.upsert({
    where: { companyId_pseudo: { companyId: company.id, pseudo: 'admin' } },
    update: {
      password: techHash,
      role: UserRole.SUPER_ADMIN,
      name: 'Technique',
      isDeleted: false,
    },
    create: {
      companyId: company.id,
      name: 'Technique',
      pseudo: 'admin',
      password: techHash,
      role: UserRole.SUPER_ADMIN,
    },
  })

  await ensureYearSequences(company.id, new Date().getFullYear())

  console.log(`Société #${company.id} ${company.name}`)
  console.log(
    `Comptes : ${operator.pseudo} (USER), ${director.pseudo} (ADMIN), ${technician.pseudo} (SUPER_ADMIN)`,
  )

  if (!existsSync(DUMP_PATH)) {
    console.log(`Dump introuvable : ${DUMP_PATH}`)
    return
  }

  const sql = stripSqlComments(readFileSync(DUMP_PATH, 'utf8'))
  const companies = readInsertRows(sql, 'companies', COMPANY_COLUMNS)
  const customers = readInsertRows(sql, 'customers', CUSTOMER_COLUMNS)
  const products = readInsertRows(sql, 'products', PRODUCT_COLUMNS)
  const estimations = readInsertRows(sql, 'estimations', ESTIMATION_COLUMNS)
  const operations = readInsertRows(sql, 'operations', OPERATION_COLUMNS)
  const invoices = readInsertRows(sql, 'invoices', INVOICE_COLUMNS)
  const collections = readInsertRows(sql, 'collections', COLLECTION_COLUMNS)

  if (
    customers.length +
      products.length +
      estimations.length +
      operations.length +
      invoices.length +
      collections.length ===
    0
  ) {
    console.log(`Aucun INSERT dans ${DUMP_PATH} — comptes par défaut uniquement.`)
    return
  }

  const profile = companies[0]
  if (profile) {
    await prisma.company.update({
      where: { id: company.id },
      data: {
        name: asString(profile.name, company.name) || company.name,
        address: asString(profile.address, company.address) || company.address,
        nif: asNullableString(profile.nif),
        email: asNullableString(profile.email),
        slogan: asNullableString(profile.slogan) || 'ShopManager',
        postBox: asNullableString(profile.post_box),
        phone1: asString(profile.number1, company.phone1) || company.phone1,
        phone2: asPhone(profile.number2),
        logoPath: asNullableString(profile.logo_path),
      },
    })
  }

  const creatorId = operator.id
  const customerIds = new Set<number>()
  const productIds = new Set<number>()
  const productNames = new Map<number, string>()
  const estimationIds = new Set<bigint>()
  const invoiceByOldId = new Map<number, { id: bigint; estimationId: bigint }>()

  for (const row of customers) {
    const id = asNumber(row.id)
    if (!id || id === MAGIC_CUSTOMER_ID) continue
    const name = asString(row.name).trim()
    if (!name) continue
    const payload = {
      companyId: company.id,
      createdById: creatorId,
      kind: asNumber(row.customer_type_id) === 1 ? CustomerKind.CORPORATE : CustomerKind.INDIVIDUAL,
      name,
      postBox: asNullableString(row.post_box),
      email: asNullableString(row.email),
      phone: asPhone(row.number) ?? asPhone(row.phone),
      nif: asNullableString(row.nif),
      address: asString(row.address, '—') || '—',
      createdAt: asDate(row.create_date),
    }
    await prisma.customer.upsert({
      where: { id },
      update: payload,
      create: { id, ...payload },
    })
    customerIds.add(id)
  }

  for (const row of products) {
    const id = asNumber(row.id)
    const code = asString(row.code).trim().toUpperCase()
    const designation = asString(row.designation).trim()
    if (!id || !code || !designation) continue
    const payload = {
      companyId: company.id,
      createdById: creatorId,
      code,
      designation,
      unitPrice: asBigInt(row.unit_price),
      isDeleted: asBool(row.deleted),
      createdAt: asDate(row.create_date),
    }
    await prisma.product.upsert({
      where: { id },
      update: payload,
      create: { id, ...payload },
    })
    productIds.add(id)
    productNames.set(id, designation)
  }

  const invoicedEstimationIds = new Set(
    invoices.map((row) => asNumber(row.estimation_id)).filter((id) => id > 0),
  )

  for (const row of estimations) {
    const id = BigInt(asNumber(row.id))
    const customerId = asNumber(row.customer_id)
    const rawCode = asString(row.code).trim()
    if (!id || !rawCode || !customerIds.has(customerId)) continue
    const createdAt = asDate(row.create_date)
    const fiscalYear = asNumber(row.fiscal_year, createdAt.getFullYear())
    const payload = {
      companyId: company.id,
      createdById: creatorId,
      customerId,
      code: formatImportedCode('ESTIMATION', fiscalYear, rawCode),
      fiscalYear,
      hasTva: asBool(row.tva),
      warranty: asNumber(row.warranty),
      totalAmount: asBigInt(row.famount),
      status: mapEstimationStatus(row.state, invoicedEstimationIds.has(Number(id))),
      createdAt,
      updatedAt: asDate(row.update_date, createdAt),
    }
    await prisma.estimation.upsert({
      where: { id },
      update: payload,
      create: { id, ...payload },
    })
    estimationIds.add(id)
  }

  if (estimationIds.size > 0) {
    await prisma.estimationItem.deleteMany({
      where: { estimationId: { in: [...estimationIds] } },
    })
  }

  for (const row of operations) {
    const operationId = asNumber(row.id)
    const productId = asNumber(row.product_id)
    const quantity = asNumber(row.quantity)
    if (!operationId || !productIds.has(productId) || quantity <= 0) continue

    const estimationId = row.estimation_id == null ? null : BigInt(asNumber(row.estimation_id))
    const customerId = asNumber(row.customer_id)
    const sellingPrice = asBigInt(row.selling_price)
    const createdAt = asDate(row.create_date)
    const deleted = asBool(row.deleted)
    const isOut = asNumber(row.operation_type_id) === 2
    let estimationItemId: bigint | null = null

    if (estimationId && estimationIds.has(estimationId) && !deleted) {
      const item = await prisma.estimationItem.create({
        data: {
          estimationId,
          productId,
          designation: productNames.get(productId) ?? 'Article',
          unitPrice: sellingPrice,
          quantity,
          discountRate: 0,
          totalPrice: sellingPrice * BigInt(quantity),
        },
      })
      estimationItemId = item.id
    }

    await prisma.stockMovement.upsert({
      where: { id: BigInt(operationId) },
      update: {
        companyId: company.id,
        createdById: creatorId,
        type: isOut ? MovementType.OUT : MovementType.IN,
        quantity,
        sellingPrice,
        productId,
        customerId: customerIds.has(customerId) ? customerId : null,
        estimationItemId,
        isDeleted: deleted,
        createdAt,
      },
      create: {
        id: BigInt(operationId),
        companyId: company.id,
        createdById: creatorId,
        type: isOut ? MovementType.OUT : MovementType.IN,
        quantity,
        sellingPrice,
        productId,
        customerId: customerIds.has(customerId) ? customerId : null,
        estimationItemId,
        isDeleted: deleted,
        createdAt,
      },
    })
  }

  for (const row of invoices) {
    const oldId = asNumber(row.id)
    const estimationId = BigInt(asNumber(row.estimation_id))
    const customerId = asNumber(row.customer_id)
    const rawCode = asString(row.code).trim()
    if (!oldId || !rawCode || !estimationIds.has(estimationId) || !customerIds.has(customerId)) {
      continue
    }
    const createdAt = asDate(row.create_date)
    const fiscalYear = asNumber(row.fiscal_year, createdAt.getFullYear())
    const existing = await prisma.invoice.findFirst({
      where: { estimationId },
      select: { id: true },
    })
    const payload = {
      companyId: company.id,
      createdById: creatorId,
      code: formatImportedCode('INVOICE', fiscalYear, rawCode),
      fiscalYear,
      status: asString(row.state).toUpperCase().includes('CANCEL')
        ? InvoiceStatus.CANCELED
        : InvoiceStatus.UNPAID,
      estimationId,
      customerId,
      createdAt,
    }
    const invoice = existing
      ? await prisma.invoice.update({ where: { id: existing.id }, data: payload })
      : await prisma.invoice.create({ data: { id: BigInt(oldId), ...payload } })
    invoiceByOldId.set(oldId, { id: invoice.id, estimationId })
  }

  for (const row of collections) {
    const oldId = asNumber(row.id)
    const invoiceRef = invoiceByOldId.get(asNumber(row.invoice_id))
    const amount = asBigInt(row.amount)
    if (!oldId || !invoiceRef || amount <= BigInt(0)) continue
    const paymentDate = asDate(row.create_date)
    await prisma.collection.upsert({
      where: { id: BigInt(oldId) },
      update: {
        companyId: company.id,
        collectorId: creatorId,
        invoiceId: invoiceRef.id,
        amount,
        paymentMethod: PaymentMethod.CASH,
        paymentDate,
      },
      create: {
        id: BigInt(oldId),
        companyId: company.id,
        collectorId: creatorId,
        invoiceId: invoiceRef.id,
        amount,
        paymentMethod: PaymentMethod.CASH,
        paymentDate,
      },
    })
  }

  const paidByEstimation = new Map<bigint, number>()
  const paymentRows = await prisma.collection.findMany({
    where: { companyId: company.id, isDeleted: false },
    select: { amount: true, invoice: { select: { estimationId: true, status: true } } },
  })
  for (const row of paymentRows) {
    if (row.invoice.status === InvoiceStatus.CANCELED) continue
    paidByEstimation.set(
      row.invoice.estimationId,
      (paidByEstimation.get(row.invoice.estimationId) ?? 0) + Number(row.amount),
    )
  }

  const invoiceRows = await prisma.invoice.findMany({
    where: { companyId: company.id },
    include: { estimation: { select: { totalAmount: true } } },
  })
  for (const invoice of invoiceRows) {
    if (invoice.status === InvoiceStatus.CANCELED) continue
    const paid = paidByEstimation.get(invoice.estimationId) ?? 0
    const status = invoiceStatusFromPaid(paid, Number(invoice.estimation.totalAmount))
    if (status !== invoice.status) {
      await prisma.invoice.update({ where: { id: invoice.id }, data: { status } })
    }
  }

  const years = new Set<number>()
  const estimationRows = await prisma.estimation.findMany({
    where: { companyId: company.id },
    select: { fiscalYear: true, code: true },
  })
  for (const row of estimationRows) years.add(row.fiscalYear)
  for (const row of invoiceRows) years.add(row.fiscalYear)
  for (const fiscalYear of years) {
    const lastEst = Math.max(
      0,
      ...estimationRows
        .filter((row) => row.fiscalYear === fiscalYear)
        .map((row) => sequenceValueFromCode(row.code)),
    )
    const lastInv = Math.max(
      0,
      ...invoiceRows
        .filter((row) => row.fiscalYear === fiscalYear)
        .map((row) => sequenceValueFromCode(row.code)),
    )
    await ensureYearSequences(company.id, fiscalYear, lastEst, lastInv)
  }

  await resetSequence('companies')
  await resetSequence('users')
  await resetSequence('customers')
  await resetSequence('products')
  await resetSequence('estimations')
  await resetSequence('estimation_items')
  await resetSequence('invoices')
  await resetSequence('collections')
  await resetSequence('stock_movements')

  console.log(
    `Import : ${customerIds.size} clients, ${productIds.size} produits, ${estimationIds.size} devis, ${invoiceByOldId.size} factures, ${collections.length} règlements lus.`,
  )
}

main()
  .catch((error) => {
    console.error('Échec du seed-migration :', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
