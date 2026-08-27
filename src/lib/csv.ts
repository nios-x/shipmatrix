/**
 * Minimal RFC-4180 CSV parser.
 *
 * Written by hand rather than pulled from a dependency because the bulk-upload
 * flow is the only consumer and it needs just two things a naive `split(',')`
 * gets wrong: quoted fields containing commas, and escaped quotes ("").
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  // Normalise line endings so CRLF files don't leave stray \r in the last field.
  const input = text.replace(/\r\n?/g, '\n');

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'; // Escaped quote.
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  // Flush the trailing field/row unless the file ended with a newline.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** Header aliases accepted in an uploaded sheet, mapped to canonical keys. */
const HEADER_ALIASES: Record<string, string> = {
  'customer name': 'customerName',
  name: 'customerName',
  'customer phone': 'customerPhone',
  phone: 'customerPhone',
  mobile: 'customerPhone',
  'customer email': 'customerEmail',
  email: 'customerEmail',
  address: 'address',
  'delivery address': 'address',
  city: 'city',
  state: 'state',
  pincode: 'pincode',
  pin: 'pincode',
  'delivery pincode': 'pincode',
  weight: 'weight',
  'weight (kg)': 'weight',
  length: 'length',
  breadth: 'breadth',
  width: 'breadth',
  height: 'height',
  'product name': 'productName',
  product: 'productName',
  'order value': 'orderValue',
  value: 'orderValue',
  amount: 'orderValue',
  'payment method': 'paymentMethod',
  payment: 'paymentMethod',
  'order id': 'orderId',
  orderid: 'orderId',
};

export interface CsvOrder {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  weight: string;
  length: string;
  breadth: string;
  height: string;
  productName: string;
  orderValue: string;
  paymentMethod: string;
  orderId: string;
}

export interface CsvParseResult {
  orders: CsvOrder[];
  /** Human-readable problems, one per rejected row. */
  errors: string[];
  /** Canonical headers that were missing from the file. */
  missingHeaders: string[];
}

const REQUIRED = ['customerName', 'customerPhone', 'address', 'pincode', 'weight'] as const;

/** The template header row offered to users for download. */
export const CSV_TEMPLATE_HEADERS = [
  'Order ID',
  'Customer Name',
  'Customer Phone',
  'Customer Email',
  'Address',
  'City',
  'State',
  'Pincode',
  'Weight (kg)',
  'Length',
  'Breadth',
  'Height',
  'Product Name',
  'Order Value',
  'Payment Method',
];

export const CSV_TEMPLATE = [
  CSV_TEMPLATE_HEADERS.join(','),
  'ORD-1001,Rahul Sharma,9876543210,rahul@example.com,"12 MG Road, Indiranagar",Bangalore,Karnataka,560001,0.5,10,10,10,T-Shirt,799,Prepaid',
].join('\n');

/** Parses an uploaded sheet into bookable orders, reporting per-row problems. */
export function parseOrdersCsv(text: string): CsvParseResult {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { orders: [], errors: ['The file is empty.'], missingHeaders: [] };
  }

  const headers = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()] || '');
  const missingHeaders = REQUIRED.filter((key) => !headers.includes(key));
  if (missingHeaders.length > 0) {
    return { orders: [], errors: [], missingHeaders: [...missingHeaders] };
  }

  const orders: CsvOrder[] = [];
  const errors: string[] = [];

  rows.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2; // 1-based, and row 1 is the header.
    const record: Record<string, string> = {};
    headers.forEach((key, col) => {
      if (key) record[key] = (cells[col] ?? '').trim();
    });

    const missing = REQUIRED.filter((key) => !record[key]);
    if (missing.length > 0) {
      errors.push(`Row ${rowNumber}: missing ${missing.join(', ')}.`);
      return;
    }
    if (!/^[1-9][0-9]{5}$/.test(record.pincode)) {
      errors.push(`Row ${rowNumber}: '${record.pincode}' is not a valid 6-digit pincode.`);
      return;
    }
    if (!(parseFloat(record.weight) > 0)) {
      errors.push(`Row ${rowNumber}: weight must be greater than 0.`);
      return;
    }

    const payment = record.paymentMethod?.toUpperCase() === 'COD' ? 'COD' : 'Prepaid';

    orders.push({
      customerName: record.customerName,
      customerPhone: record.customerPhone,
      customerEmail: record.customerEmail || '',
      address: record.address,
      city: record.city || '',
      state: record.state || '',
      pincode: record.pincode,
      weight: record.weight,
      length: record.length || '10',
      breadth: record.breadth || '10',
      height: record.height || '10',
      productName: record.productName || 'Products',
      orderValue: record.orderValue || '0',
      paymentMethod: payment,
      orderId: record.orderId || '',
    });
  });

  return { orders, errors, missingHeaders: [] };
}
