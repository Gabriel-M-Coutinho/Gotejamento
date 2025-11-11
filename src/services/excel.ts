import * as XLSX from 'xlsx';

export class ExcelService {
  
    static ReadExcel(filePath: string): any[] {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        return XLSX.utils.sheet_to_json(sheet);
    }

    static WriteExcel(fileName: string, data: any[]) {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        XLSX.writeFile(wb, fileName);
    }
}