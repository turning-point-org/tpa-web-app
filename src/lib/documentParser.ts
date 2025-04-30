/**
 * Extract text from different file types
 * This is a placeholder - you'll need to implement real parsers based on file type
 * or use a service like Azure Form Recognizer
 */

// Import only the default function to avoid initialization issues
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
// Import xlsx for Excel file parsing
const XLSX = require('xlsx');

export async function extractTextFromFile(
  fileBuffer: Buffer,
  contentType: string
): Promise<string | null> {
  // For PDF files, you would use a PDF parsing library 
  // For Office docs, you would use appropriate parsers
  // For plain text files:
  if (contentType === 'text/plain' || contentType === 'text/csv') {
    return fileBuffer.toString('utf-8');
  }
  
  // For PDF files - now implemented with pdf-parse
  if (contentType === 'application/pdf') {
    try {
      console.log('Parsing PDF file...');
      // Pass explicit options to avoid loading test files
      const options = {
        // No need to load external files
        disableFontFace: true,
        useSystemFonts: false
      };
      
      const result = await pdfParse(fileBuffer, options);
      console.log(`Successfully extracted ${result.text.length} characters from PDF`);
      return result.text;
    } catch (error) {
      console.error('Error parsing PDF:', error);
      return null;
    }
  }
  
  // For Excel files
  if (contentType === 'application/vnd.ms-excel' || 
      contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    try {
      console.log('Parsing Excel file...');
      
      // Read the workbook from buffer
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      
      // Initialize text content
      let textContent = '';
      
      // Process each worksheet
      workbook.SheetNames.forEach((sheetName: string) => {
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert worksheet to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Add sheet name as heading
        textContent += `Sheet: ${sheetName}\n\n`;
        
        // Convert to readable text format
        jsonData.forEach((row: any) => {
          if (row && row.length > 0) {
            textContent += row.join('\t') + '\n';
          }
        });
        
        textContent += '\n\n';
      });
      
      console.log(`Successfully extracted ${textContent.length} characters from Excel file`);
      return textContent;
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      return null;
    }
  }
  
  // For Word documents - this is a placeholder
  if (contentType === 'application/msword' || 
      contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    // You'd use a library like mammoth or call an external service
    console.log('Word document parsing not implemented');
    return null;
  }
  
  return null;
} 