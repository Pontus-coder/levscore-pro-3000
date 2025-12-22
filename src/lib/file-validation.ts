/**
 * File validation utilities for secure file uploads
 */

// Maximum file size: 10MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024

// Maximum rows to process (prevent DoS)
export const MAX_ROWS = 100000

// Allowed MIME types for Excel files
export const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv', // .csv
  'application/csv',
]

// Allowed file extensions
export const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv']

/**
 * Excel file magic bytes (file signatures)
 * XLSX: PK (ZIP format) - 50 4B 03 04
 * XLS: D0 CF 11 E0 (OLE2 format)
 * CSV: No specific signature, validate differently
 */
const XLSX_MAGIC = [0x50, 0x4B, 0x03, 0x04]
const XLS_MAGIC = [0xD0, 0xCF, 0x11, 0xE0]

export interface FileValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate file size
 */
export function validateFileSize(file: File): FileValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Filen är för stor. Max ${MAX_FILE_SIZE / (1024 * 1024)}MB tillåtet.`,
    }
  }
  return { valid: true }
}

/**
 * Validate file extension
 */
export function validateFileExtension(filename: string): FileValidationResult {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Ogiltig filtyp. Tillåtna format: ${ALLOWED_EXTENSIONS.join(', ')}`,
    }
  }
  return { valid: true }
}

/**
 * Validate file MIME type
 */
export function validateMimeType(file: File): FileValidationResult {
  // Check MIME type (note: can be spoofed, so we also check magic bytes)
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    // Allow empty type for some browsers
    if (file.type !== '') {
      return {
        valid: false,
        error: 'Ogiltig filtyp. Ladda upp en Excel-fil (.xlsx, .xls) eller CSV.',
      }
    }
  }
  return { valid: true }
}

/**
 * Validate file magic bytes (file signature)
 */
export async function validateFileMagicBytes(file: File): Promise<FileValidationResult> {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  
  // CSV files don't have magic bytes, validate differently
  if (ext === '.csv') {
    // Check if file starts with printable ASCII characters
    const buffer = await file.slice(0, 1024).arrayBuffer()
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < Math.min(bytes.length, 100); i++) {
      const byte = bytes[i]
      // Allow printable ASCII, newlines, carriage returns, tabs
      if (byte !== 0x09 && byte !== 0x0A && byte !== 0x0D && (byte < 0x20 || byte > 0x7E)) {
        // Allow UTF-8 BOM
        if (i === 0 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
          continue
        }
        return {
          valid: false,
          error: 'Ogiltig CSV-fil. Filen innehåller ogiltiga tecken.',
        }
      }
    }
    return { valid: true }
  }
  
  // Read first 4 bytes for magic number check
  const buffer = await file.slice(0, 4).arrayBuffer()
  const bytes = new Uint8Array(buffer)
  
  // Check for XLSX (ZIP format)
  if (ext === '.xlsx') {
    const isValidXlsx = XLSX_MAGIC.every((byte, i) => bytes[i] === byte)
    if (!isValidXlsx) {
      return {
        valid: false,
        error: 'Ogiltig XLSX-fil. Filen verkar vara korrupt eller manipulerad.',
      }
    }
  }
  
  // Check for XLS (OLE2 format)
  if (ext === '.xls') {
    const isValidXls = XLS_MAGIC.every((byte, i) => bytes[i] === byte)
    if (!isValidXls) {
      return {
        valid: false,
        error: 'Ogiltig XLS-fil. Filen verkar vara korrupt eller manipulerad.',
      }
    }
  }
  
  return { valid: true }
}

/**
 * Comprehensive file validation
 */
export async function validateFile(file: File): Promise<FileValidationResult> {
  // Check file size
  const sizeCheck = validateFileSize(file)
  if (!sizeCheck.valid) return sizeCheck
  
  // Check file extension
  const extCheck = validateFileExtension(file.name)
  if (!extCheck.valid) return extCheck
  
  // Check MIME type
  const mimeCheck = validateMimeType(file)
  if (!mimeCheck.valid) return mimeCheck
  
  // Check magic bytes
  const magicCheck = await validateFileMagicBytes(file)
  if (!magicCheck.valid) return magicCheck
  
  return { valid: true }
}

/**
 * Sanitize filename to prevent path traversal attacks
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes
  return filename
    .replace(/[\\/]/g, '_')
    .replace(/\0/g, '')
    .replace(/\.\./g, '_')
    .substring(0, 255) // Limit filename length
}

